// app/api/check-gamusa/route.ts
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export async function GET(request: NextRequest) {
    // Extract Gamusa ID from search params
    const gamusaId = request.nextUrl.searchParams.get("gamusaId");

    // Validate Gamusa ID
    if (!gamusaId) {
        return NextResponse.json(
            { message: "Invalid Gamusa ID" },
            { status: 400 }
        );
    }

    // Contract details - MAKE SURE THIS MATCHES YOUR CONTRACT EXACTLY

    try {
        // Create a public client to interact with the blockchain
        const client = createPublicClient({
            chain: baseSepolia,
            transport: http(
                // Optional: Specify a specific RPC endpoint if needed
                "https://sepolia.base.org"
            ),
        });

        console.log("Attempting to call contract with:", {
            address: CONTRACT_ADDRESS,
            gamusaId: gamusaId,
        });

        try {
            const isClaimed = await client.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: "isGamusaClaimed",
                args: [gamusaId],
            });

            console.log("Contract call successful:", isClaimed);

            return NextResponse.json({
                isClaimed,
                message: isClaimed
                    ? "This Gamusa has already been claimed"
                    : "Gamusa is available for claiming",
            });
        } catch (contractError) {
            console.error("Detailed Contract Call Error:", {
                error: contractError,
                stringError: JSON.stringify(contractError, null, 2),
            });

            return NextResponse.json(
                {
                    message: "Error calling contract function",
                    error:
                        contractError instanceof Error
                            ? contractError.message
                            : "Unknown contract interaction error",
                    details: {
                        contractAddress: CONTRACT_ADDRESS,
                        gamusaId: gamusaId,
                        rawError: JSON.stringify(contractError),
                    },
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Blockchain Interaction Error:", error);
        return NextResponse.json(
            {
                message: "Unable to interact with blockchain",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
