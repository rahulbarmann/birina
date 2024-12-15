/* eslint-disable react/jsx-no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import toast from "react-hot-toast";
import {
    useWriteContract,
    useWaitForTransactionReceipt,
    useSimulateContract,
    useWalletClient,
} from "wagmi";
import { config } from "./config";
import { useAccount } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { ConnectKitButton } from "connectkit";
import { createNexusClient, createBicoPaymasterClient } from "@biconomy/sdk";
import { baseSepolia } from "viem/chains";
import { http, encodeFunctionData, parseEther } from "viem";

const QRDataSchema = z.object({
    gamusaId: z.string().min(1, "Gamusa ID is required"),
    location: z.string().min(1, "Location is required"),
    imageHash: z.string().min(1, "Image hash is required"),
    artisanName: z.string().optional(),
    creationDate: z.string().optional(),
});

type QRData = z.infer<typeof QRDataSchema>;

// Biconomy configuration
const BUNDLER_URL =
    "https://bundler.biconomy.io/api/v2/84532/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44";
const PAYMASTER_URL =
    "https://paymaster.biconomy.io/api/v1/84532/yV3-ZyMDk.8d7f2347-7440-4cf4-9238-e0a79cb4c0f5";

const GamusaScanner = () => {
    const [scanData, setScanData] = useState<QRData | null>(null);
    const [showScanner, setShowScanner] = useState(true);
    const [error, setError] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [isCheckingClaim, setIsCheckingClaim] = useState(false);
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const [isTransacting, setIsTransacting] = useState(false);
    const [currentTransactionHash, setCurrentTransactionHash] = useState<
        string | null
    >(null);
    const [nexusClient, setNexusClient] = useState<any>(null);

    const { data: simulateData } = useSimulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "claimGamusa",
        args: scanData ? [scanData.gamusaId, scanData.location, ""] : undefined,
    });
    const {
        isPending: isMinting,
        isSuccess,
        error: mintingError,
        data: txHash,
        writeContract: write,
    } = useWriteContract();

    useEffect(() => {
        const initializeBiconomy = async () => {
            if (!address || !walletClient) return;
            try {
                const paymaster = createBicoPaymasterClient({
                    paymasterUrl: PAYMASTER_URL,
                });

                const client = await createNexusClient({
                    signer: walletClient,
                    chain: baseSepolia,
                    transport: http(),
                    bundlerTransport: http(BUNDLER_URL),
                    paymaster,
                });

                setNexusClient(client);
            } catch (error) {
                console.error("Error initializing Biconomy:", error);
                setError("Failed to initialize gasless transaction support");
            }
        };

        initializeBiconomy();
    }, [address, walletClient]);

    const getBlockExplorerUrl = (hash: string) => {
        const baseExplorerUrl = "https://sepolia.basescan.org";
        return `${baseExplorerUrl}/tx/${hash}`;
    };

    const handleScan = async (detectedCodes: IDetectedBarcode[]) => {
        if (detectedCodes.length > 0) {
            try {
                const qrCode = detectedCodes[0].rawValue;
                console.log("Raw QR Value:", qrCode);

                const parsedData = JSON.parse(qrCode);
                console.log("Parsed Data:", parsedData);

                const validationResult = QRDataSchema.safeParse(parsedData);

                if (!validationResult.success) {
                    console.log("Validation Errors:", validationResult.error);
                    setError(
                        "Invalid QR code format. Please scan a valid Gamusa QR code."
                    );
                    return;
                }

                setIsCheckingClaim(true);
                setError("");

                try {
                    const response = await fetch(
                        `/api/check-gamusa?gamusaId=${encodeURIComponent(
                            validationResult.data.gamusaId
                        )}`,
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                            errorData.message ||
                                "Failed to verify Gamusa status"
                        );
                    }

                    const result = await response.json();

                    if (result.isClaimed) {
                        setError("This Gamusa has already been claimed.");
                        return;
                    }

                    setScanData(validationResult.data);
                    setShowScanner(false);
                    setError("");
                } catch (checkError) {
                    console.error("Error checking Gamusa status:", checkError);
                    setError(
                        checkError instanceof Error
                            ? checkError.message
                            : "Unable to verify Gamusa status. Please try again."
                    );
                } finally {
                    setIsCheckingClaim(false);
                }
            } catch (error) {
                console.error("Scanning Error:", error);
                setError("Could not read QR code. Please try again.");
                setIsCheckingClaim(false);
            }
        }
    };

    const handleMint = async () => {
        if (!scanData || !nexusClient) {
            setError("Missing required data for minting");
            return;
        }

        try {
            setIsUploading(true);
            setError("");
            setIsTransacting(false);

            const metadata = {
                name: `Gamusa #${scanData.gamusaId}`,
                description: `Authentic Assamese Gamusa from ${scanData.location}`,
                image: `ipfs://${scanData.imageHash}`,
                attributes: {
                    gamusaId: scanData.gamusaId,
                    location: scanData.location,
                    artisanName: scanData.artisanName,
                    creationDate: scanData.creationDate,
                },
            };

            const response = await fetch("/api/upload-metadata", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ metadata }),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error("Invalid API response format");
            }

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to upload metadata");
            }

            setIsUploading(false);
            setIsTransacting(true);
            const toastId = toast.loading("Preparing transaction...");

            try {
                if (nexusClient) {
                    // Biconomy gasless transaction path
                    toast.loading("Gasless transaction starting...", {
                        id: toastId,
                    });

                    const callData = encodeFunctionData({
                        abi: CONTRACT_ABI,
                        functionName: "claimGamusa",
                        args: [
                            scanData.gamusaId,
                            scanData.location,
                            data.tokenURI,
                        ],
                    });

                    const tx = {
                        to: CONTRACT_ADDRESS,
                        data: callData,
                        value: parseEther("0"),
                    };

                    const userOpResponse = await nexusClient.sendTransaction({
                        calls: [tx],
                    });

                    const receipt =
                        await nexusClient.waitForUserOperationReceipt({
                            hash: userOpResponse,
                            timeout: 60000,
                        });

                    setCurrentTransactionHash(receipt.receipt.transactionHash);
                } else if (simulateData) {
                    const simulation = simulateData as unknown as {
                        request?: {
                            abi: typeof CONTRACT_ABI;
                            address: typeof CONTRACT_ADDRESS;
                            functionName: "claimGamusa";
                            args: [string, string, string];
                        };
                    };

                    if (!simulation.request)
                        throw new Error("Simulation failed");

                    const hash = await writeContract(config, {
                        ...simulation.request,
                        account: address,
                    });

                    toast.loading("Transaction pending...", { id: toastId });

                    const receipt = await waitForTransactionReceipt(config, {
                        hash,
                        timeout: 60_000,
                    });

                    setCurrentTransactionHash(receipt.transactionHash);
                } else {
                    throw new Error("No valid transaction method available");
                }

                toast.success(
                    () => (
                        <div className="flex flex-col gap-2">
                            <span>Successfully minted your Gamusa NFT!</span>
                            <a
                                href={getBlockExplorerUrl(
                                    currentTransactionHash!
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                            >
                                View on Block Explorer
                            </a>
                        </div>
                    ),
                    { id: toastId, duration: 5000 }
                );
            } catch (txError) {
                console.error("Transaction error:", txError);
                toast.error("Transaction failed. Please try again.", {
                    id: toastId,
                });
                throw txError;
            }
        } catch (error) {
            console.error("Minting error:", error);
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to mint NFT. Please try again."
            );
            toast.error("Failed to mint NFT. Please try again.");
        } finally {
            setIsUploading(false);
            setIsTransacting(false);
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen relative overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50"
                style={{
                    fontFamily: "'Poppins', sans-serif",
                }}
            >
                <div className="fixed inset-0 -z-10">
                    {/* <MotifPattern /> */}
                    <motion.div
                        animate={{
                            rotate: [0, 360],
                        }}
                        transition={{
                            duration: 200,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute inset-0 opacity-10"
                    >
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(255,166,0,0.1),_transparent_70%)]" />
                    </motion.div>
                </div>

                <div className="container mx-auto px-4 py-8 relative">
                    <motion.div
                        className="text-center mb-12 relative"
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <motion.div
                            className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-orange-600"
                            initial={{ width: 0 }}
                            animate={{ width: 128 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        />

                        <h1
                            className="text-6xl font-bold text-orange-800 mb-4"
                            style={{
                                fontFamily: "'Cinzel', serif",
                                background:
                                    "linear-gradient(to right, #92400e, #ea580c)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Birina: Digital Heritage of Gamusa
                        </h1>
                        <p className="text-xl text-orange-700 max-w-2xl mx-auto font-light">
                            Preserve and authenticate the rich tradition of
                            Assamese Gamusa through blockchain technology
                        </p>
                    </motion.div>

                    <motion.div
                        layout
                        className="max-w-md mx-auto relative"
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-200 via-amber-200 to-orange-200 opacity-20 blur-xl rounded-3xl transform -rotate-6" />
                        <Card className="bg-white/90 backdrop-blur-lg shadow-2xl border-0 rounded-2xl overflow-hidden">
                            <CardContent className="p-8">
                                <div className="mb-8 transform hover:scale-102 transition-transform">
                                    <ConnectKitButton theme="retro" />
                                </div>

                                <AnimatePresence mode="wait">
                                    {isConnected && (
                                        <>
                                            {showScanner ? (
                                                <motion.div
                                                    key="scanner"
                                                    initial={{
                                                        opacity: 0,
                                                        y: 20,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        y: -20,
                                                    }}
                                                    className="w-80 h-80 rounded-2xl overflow-hidden shadow-xl mx-auto relative"
                                                >
                                                    <Scanner
                                                        onScan={handleScan}
                                                    />
                                                    {isCheckingClaim && (
                                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                                                            <div className="bg-white/90 p-6 rounded-xl flex flex-col items-center gap-3">
                                                                <Spinner className="h-8 w-8" />
                                                                <span className="text-sm font-medium">
                                                                    Verifying
                                                                    Gamusa...
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ) : scanData ? (
                                                <motion.div
                                                    key="data"
                                                    initial={{
                                                        opacity: 0,
                                                        y: 20,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    exit={{
                                                        opacity: 0,
                                                        y: -20,
                                                    }}
                                                    className="space-y-6"
                                                >
                                                    {currentTransactionHash ? (
                                                        <>
                                                            <Alert className="bg-green-50/80 backdrop-blur border-green-200">
                                                                <AlertTitle className="text-lg font-semibold">
                                                                    Successfully
                                                                    Claimed!
                                                                </AlertTitle>
                                                                <AlertDescription className="space-y-3">
                                                                    <p>
                                                                        Your
                                                                        Gamusa
                                                                        NFT has
                                                                        been
                                                                        successfully
                                                                        minted!
                                                                        🎉
                                                                    </p>
                                                                    <a
                                                                        href={getBlockExplorerUrl(
                                                                            currentTransactionHash
                                                                        )}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:text-blue-800 underline block transition-colors"
                                                                    >
                                                                        View on
                                                                        Block
                                                                        Explorer
                                                                    </a>
                                                                </AlertDescription>
                                                            </Alert>
                                                            <Button
                                                                onClick={() => {
                                                                    setShowScanner(
                                                                        true
                                                                    );
                                                                    setScanData(
                                                                        null
                                                                    );
                                                                    setCurrentTransactionHash(
                                                                        null
                                                                    );
                                                                }}
                                                                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg"
                                                            >
                                                                Scan Another
                                                                Gamusa
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Alert className="bg-orange-50/80 backdrop-blur border-orange-200">
                                                                <AlertTitle className="text-lg font-semibold">
                                                                    Gamusa
                                                                    Details
                                                                </AlertTitle>
                                                                <AlertDescription>
                                                                    <div className="space-y-3 mt-3">
                                                                        <p>
                                                                            <span className="font-semibold">
                                                                                ID:
                                                                            </span>{" "}
                                                                            {
                                                                                scanData.gamusaId
                                                                            }
                                                                        </p>
                                                                        <p>
                                                                            <span className="font-semibold">
                                                                                Location:
                                                                            </span>{" "}
                                                                            {
                                                                                scanData.location
                                                                            }
                                                                        </p>
                                                                        {scanData.artisanName && (
                                                                            <p>
                                                                                <span className="font-semibold">
                                                                                    Artisan:
                                                                                </span>{" "}
                                                                                {
                                                                                    scanData.artisanName
                                                                                }
                                                                            </p>
                                                                        )}
                                                                        {scanData.creationDate && (
                                                                            <p>
                                                                                <span className="font-semibold">
                                                                                    Created:
                                                                                </span>{" "}
                                                                                {
                                                                                    scanData.creationDate
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </AlertDescription>
                                                            </Alert>

                                                            <Button
                                                                onClick={
                                                                    handleMint
                                                                }
                                                                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg"
                                                                disabled={
                                                                    isUploading ||
                                                                    isTransacting
                                                                }
                                                            >
                                                                {isUploading ||
                                                                isTransacting ? (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <Spinner />
                                                                        <span>
                                                                            {isUploading
                                                                                ? "Preparing Metadata..."
                                                                                : isTransacting
                                                                                ? "Minting..."
                                                                                : "Claim Gamusa NFT"}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    "Claim Gamusa NFT"
                                                                )}
                                                            </Button>

                                                            <Button
                                                                onClick={() => {
                                                                    setShowScanner(
                                                                        true
                                                                    );
                                                                    setScanData(
                                                                        null
                                                                    );
                                                                }}
                                                                variant="outline"
                                                                className="w-full border-orange-200 hover:bg-orange-50 transition-colors"
                                                                disabled={
                                                                    isUploading ||
                                                                    isTransacting
                                                                }
                                                            >
                                                                Scan Another
                                                            </Button>
                                                        </>
                                                    )}
                                                </motion.div>
                                            ) : null}
                                        </>
                                    )}

                                    {isSuccess && (
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="space-y-6"
                                        >
                                            <Alert className="bg-green-50/80 backdrop-blur border-green-200">
                                                <AlertTitle className="text-lg font-semibold">
                                                    Success!
                                                </AlertTitle>
                                                <AlertDescription className="space-y-3">
                                                    <p>
                                                        Your Gamusa NFT has been
                                                        successfully claimed! 🎉
                                                    </p>
                                                    {txHash && (
                                                        <a
                                                            href={getBlockExplorerUrl(
                                                                txHash
                                                            )}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 underline block transition-colors"
                                                        >
                                                            View on Block
                                                            Explorer
                                                        </a>
                                                    )}
                                                </AlertDescription>
                                            </Alert>
                                            <Button
                                                onClick={() => {
                                                    setShowScanner(true);
                                                    setScanData(null);
                                                }}
                                                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg"
                                            >
                                                Scan Another Gamusa
                                            </Button>
                                        </motion.div>
                                    )}

                                    {error && (
                                        <motion.div
                                            key="error"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="mt-6"
                                        >
                                            <Alert
                                                variant="destructive"
                                                className="border-red-200 bg-red-50/80 backdrop-blur"
                                            >
                                                <AlertTitle>Error</AlertTitle>
                                                <AlertDescription>
                                                    {error}
                                                </AlertDescription>
                                            </Alert>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <div className="fixed -z-10 inset-0 overflow-hidden pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            transition={{ duration: 1 }}
                            className="absolute inset-0"
                        >
                            <div className="absolute top-0 left-0 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
                            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
                            <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </>
    );
};

export default GamusaScanner;
