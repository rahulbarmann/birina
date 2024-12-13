/* eslint-disable @typescript-eslint/no-unused-vars */
// app/api/upload-metadata/route.ts
import { NextResponse } from "next/server";
import PinataClient from "@pinata/sdk";

const pinata = new PinataClient({
    pinataApiKey: process.env.PINATA_API_KEY || "",
    pinataSecretApiKey: process.env.PINATA_SECRET_KEY || "",
});

export async function POST(req: Request) {
    try {
        if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
            return NextResponse.json(
                { error: "Pinata configuration missing" },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { metadata } = body;

        if (!metadata) {
            return NextResponse.json(
                { error: "No metadata provided" },
                { status: 400 }
            );
        }

        const result = await pinata.pinJSONToIPFS(metadata);

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

export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { status: 200 });
}
