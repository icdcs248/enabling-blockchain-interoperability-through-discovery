import Head from "next/head";
import { Box } from "@chakra-ui/react";
import { Navbar, Landpage, Footer } from "../component";

export default function Home() {
  return (
    <Box>
      <Head>
        <title>DNS Client</title>
        <meta name="description" content="The frontend to the dns light client" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <Landpage />

      <Footer />
    </Box>
  );
}
