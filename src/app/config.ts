import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const config = createConfig({
    chains: [baseSepolia],

    ssr: true,
    transports: {
        [baseSepolia.id]: http(),
    },
});
