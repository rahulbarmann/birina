/* eslint-disable @typescript-eslint/no-unused-vars */
// app/api/upload-metadata/route.ts
import { NextResponse } from "next/server";
import PinataClient from "@pinata/sdk";

// Initialize Pinata client outside the handler
const pinata = new PinataClient({
    pinataApiKey: process.env.PINATA_API_KEY || "",
    pinataSecretApiKey: process.env.PINATA_SECRET_KEY || "",
});

// Export the POST handler
export async function POST(req: Request) {
    try {
        // Validate environment variables
        if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
            return NextResponse.json(
                { error: "Pinata configuration missing" },
                { status: 500 }
            );
        }

        // Parse the request body
        const body = await req.json();
        const { metadata } = body;

        if (!metadata) {
            return NextResponse.json(
                { error: "No metadata provided" },
                { status: 400 }
            );
        }

        // Upload to Pinata
        const result = await pinata.pinJSONToIPFS(metadata);

        // Return success response
        return NextResponse.json({
            success: true,
            tokenURI: `ipfs://${result.IpfsHash}`,
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        );
    }
}

// Optionally handle OPTIONS request for CORS
export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { status: 200 });
}
