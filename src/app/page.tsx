"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import toast from "react-hot-toast";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { config } from "./config";
import { useAccount, useSimulateContract } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { ConnectKitButton } from "connectkit";

const QRDataSchema = z.object({
    gamusaId: z.string().min(1, "Gamusa ID is required"),
    location: z.string().min(1, "Location is required"),
    imageHash: z.string().min(1, "Image hash is required"),
    artisanName: z.string().optional(),
    creationDate: z.string().optional(),
});

type QRData = z.infer<typeof QRDataSchema>;

const GamusaScanner = () => {
    const [scanData, setScanData] = useState<QRData | null>(null);
    const [showScanner, setShowScanner] = useState(true);
    const [error, setError] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const [isCheckingClaim, setIsCheckingClaim] = useState(false);
    const { isConnected } = useAccount();
    const [isTransacting, setIsTransacting] = useState(false); // New state for transaction status
    const [currentTransactionHash, setCurrentTransactionHash] = useState<
        string | null
    >(null); // Track successful transaction

    // Setup contract write functionality
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
    } = useWriteContract();

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

                // Validate QR data against schema
                const validationResult = QRDataSchema.safeParse(parsedData);

                if (!validationResult.success) {
                    console.log("Validation Errors:", validationResult.error);
                    setError(
                        "Invalid QR code format. Please scan a valid Gamusa QR code."
                    );
                    return;
                }

                // Set checking claim status
                setIsCheckingClaim(true);
                setError("");

                // Check if Gamusa is already claimed
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
        if (!scanData || !simulateData?.request) {
            setError("Missing required data for minting");
            return;
        }

        try {
            setIsUploading(true);
            setError("");
            setIsTransacting(false); // Reset transaction state

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
            setIsTransacting(true); // Start transaction state

            // Show initial loading toast
            const toastId = toast.loading("Preparing transaction...");

            try {
                // Get wagmi config

                // Execute the contract write using wagmi/core
                const hash = await writeContract(config, {
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: "claimGamusa",
                    args: [scanData.gamusaId, scanData.location, data.tokenURI],
                });

                // Update toast to show pending transaction
                toast.loading("Transaction pending...", { id: toastId });

                // Wait for transaction receipt
                const receipt = await waitForTransactionReceipt(config, {
                    hash,
                });

                // Store the successful transaction hash
                setCurrentTransactionHash(receipt.transactionHash);

                // Show success toast with explorer link
                toast.success(
                    () => (
                        <div className="flex flex-col gap-2">
                            <span>Successfully minted your Gamusa NFT!</span>
                            <a
                                href={getBlockExplorerUrl(
                                    receipt.transactionHash
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
                className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100"
            >
                <div className="container mx-auto px-4 py-8">
                    {/* Hero Section */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-5xl font-bold text-orange-800 mb-4">
                            Birina: Digital Heritage of Gamusa
                        </h1>
                        <p className="text-xl text-orange-700 max-w-2xl mx-auto">
                            Preserve and authenticate the rich tradition of
                            Assamese Gamusa through blockchain technology
                        </p>
                    </motion.div>

                    {/* Main Card */}
                    <motion.div
                        layout
                        className="max-w-md mx-auto"
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="bg-white/80 backdrop-blur shadow-xl">
                            <CardContent className="p-6">
                                {/* Wallet Connection */}
                                <div className="mb-6">
                                    <ConnectKitButton theme="retro" />
                                </div>

                                <AnimatePresence mode="wait">
                                    {/* Scanner or Data Display */}
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
                                                    className="w-80 h-80 rounded-lg overflow-hidden shadow-md mx-auto relative"
                                                >
                                                    <Scanner
                                                        onScan={handleScan}
                                                    />
                                                    {isCheckingClaim && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <div className="bg-white p-4 rounded-lg flex flex-col items-center gap-2">
                                                                <Spinner className="h-8 w-8" />
                                                                <span className="text-sm">
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
                                                    className="space-y-4"
                                                >
                                                    {currentTransactionHash ? (
                                                        // Success state - show only transaction details and scan another option
                                                        <>
                                                            <Alert className="bg-green-50">
                                                                <AlertTitle>
                                                                    Successfully
                                                                    Claimed!
                                                                </AlertTitle>
                                                                <AlertDescription className="space-y-2">
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
                                                                        className="text-blue-600 hover:text-blue-800 underline block"
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
                                                                className="w-full"
                                                            >
                                                                Scan Another
                                                                Gamusa
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        // Pre-mint state - show details and mint option
                                                        <>
                                                            <Alert className="bg-orange-50">
                                                                <AlertTitle>
                                                                    Gamusa
                                                                    Details
                                                                </AlertTitle>
                                                                <AlertDescription>
                                                                    <div className="space-y-2 mt-2">
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
                                                                className="w-full bg-orange-600 hover:bg-orange-700"
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
                                                                className="w-full"
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

                                    {/* Success State */}
                                    {isSuccess && (
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="space-y-4"
                                        >
                                            <Alert className="bg-green-50">
                                                <AlertTitle>
                                                    Success!
                                                </AlertTitle>
                                                <AlertDescription className="space-y-2">
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
                                                            className="text-blue-600 hover:text-blue-800 underline block"
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
                                                className="w-full"
                                            >
                                                Scan Another Gamusa
                                            </Button>
                                        </motion.div>
                                    )}
                                    {/* Error Display */}
                                    {error && (
                                        <motion.div
                                            key="error"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="mt-4"
                                        >
                                            <Alert variant="destructive">
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

                    {/* Decorative Elements */}
                    <motion.div
                        className="fixed -z-10 inset-0 overflow-hidden pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                    >
                        <div className="absolute top-0 left-0 w-64 h-64 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
                        <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
                    </motion.div>
                </div>
            </motion.div>
        </>
    );
};

export default GamusaScanner;
