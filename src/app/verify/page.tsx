"use client";

import { useState } from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import Modal from "react-modal";

export default function Verify() {
    const [scannedUrl, setScannedUrl] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleScan = (detectedCodes: IDetectedBarcode[]) => {
        if (detectedCodes.length > 0) {
            const qrCode = detectedCodes[0].rawValue;
            setScannedUrl(qrCode);
            setIsModalOpen(true);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setScannedUrl(null);
    };

    const visitLink = () => {
        if (scannedUrl) {
            window.open(scannedUrl, "_blank");
        }
        closeModal();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
                Verify on Birina
            </h1>
            <div className="w-80 h-80 rounded-lg overflow-hidden shadow-md">
                <Scanner onScan={handleScan} />
            </div>

            <Modal
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                contentLabel="Scanned QR Code"
                className="bg-white rounded-lg p-6 shadow-xl max-w-md mx-auto mt-20 relative"
                overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
            >
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    QR Code Detected
                </h2>
                <p className="text-gray-600 mb-2">
                    Do you want to visit this link?
                </p>
                <p className="text-blue-600 break-words mb-6">{scannedUrl}</p>
                <div className="flex space-x-4">
                    <button
                        onClick={visitLink}
                        className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                    >
                        Yes, Visit
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
