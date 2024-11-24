"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import Modal from "react-modal";
import {
    useAbstraxionAccount,
    useAbstraxionSigningClient,
} from "@burnt-labs/abstraxion";

interface NFTData {
    tokenId: string;
    tokenUri: string;
    contractAddress: string;
    metadata?: Record<string, unknown>;
}

export default function NFTMintingPage() {
    const [loading, setLoading] = useState(false);
    const [qrData, setQrData] = useState<NFTData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mintingStatus, setMintingStatus] = useState("");
    const [scannerActive, setScannerActive] = useState(true);

    const { data: account } = useAbstraxionAccount();
    const { client } = useAbstraxionSigningClient();

    const handleScan = (detectedCodes: IDetectedBarcode[]) => {
        if (detectedCodes.length > 0) {
            try {
                const qrCode = detectedCodes[0].rawValue;
                const parsedData = JSON.parse(qrCode) as NFTData;

                if (!parsedData.tokenId || !parsedData.contractAddress) {
                    throw new Error("Invalid NFT data format");
                }

                setQrData(parsedData);
                setIsModalOpen(true);
                setScannerActive(false);
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Unknown error occurred";
                setMintingStatus(`Invalid QR code format: ${errorMessage}`);
            }
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setScannerActive(true);
        setQrData(null);
    };

    const mintNFT = async () => {
        if (!qrData || !client || !account.bech32Address) {
            setMintingStatus("Please connect your wallet first");
            return;
        }

        setLoading(true);
        setMintingStatus("Initiating minting process...");

        try {
            const msg = {
                mint_nft: {
                    token_id: qrData.tokenId,
                    owner: account.bech32Address,
                    token_uri: qrData.tokenUri,
                    extension: qrData.metadata || {},
                },
            };

            const result = await client.execute(
                account.bech32Address,
                qrData.contractAddress,
                msg,
                "auto",
                "",
                []
            );

            setMintingStatus(
                `NFT minted successfully! Transaction hash: ${result.transactionHash}`
            );
            closeModal();
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred";
            console.error(error);
            setMintingStatus(`Minting failed: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
                Mint Your NFT
            </h1>

            {account.bech32Address && scannerActive && (
                <div className="w-80 h-80 rounded-lg overflow-hidden shadow-md">
                    <Scanner onScan={handleScan} />
                </div>
            )}

            {mintingStatus && (
                <div className="mt-4 p-4 rounded-lg bg-white shadow-md max-w-md">
                    <p className="text-sm text-center text-gray-700">
                        {mintingStatus}
                    </p>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                contentLabel="NFT Minting Confirmation"
                className="bg-white rounded-lg p-6 shadow-xl max-w-md mx-auto mt-20 relative"
                overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
            >
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    NFT Details Detected
                </h2>
                {qrData && (
                    <div className="mb-6">
                        <p className="text-gray-600 mb-2">
                            Token ID: {qrData.tokenId}
                        </p>
                        {qrData.tokenUri && (
                            <p className="text-gray-600 mb-2">
                                Token URI: {qrData.tokenUri}
                            </p>
                        )}
                        <p className="text-gray-600 mb-2 break-all">
                            Contract: {qrData.contractAddress}
                        </p>
                    </div>
                )}
                <div className="flex space-x-4">
                    <button
                        onClick={mintNFT}
                        disabled={loading}
                        className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:bg-blue-300"
                    >
                        {loading ? "Minting..." : "Mint NFT"}
                    </button>
                    <button
                        onClick={closeModal}
                        className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition"
                    >
                        Cancel
                    </button>
                </div>
            </Modal>
        </div>
    );
}
