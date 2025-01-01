import React, {useState} from "react";

import {
    chakra,
    Box,
    Flex,
    useColorModeValue,
    VisuallyHidden,
    HStack,
    useDisclosure,
    VStack,
    IconButton,
    CloseButton,
    Tabs,
    TabList,
    Tab,
    Heading,
    List,
    Center,
    useColorMode, TabPanels, TabPanel,
} from "@chakra-ui/react";

import {WalletModel} from "..";
import SearchBar from "../SearchBar";

//import { Logo } from "../../public"

import {AiOutlineMenu, AiOutlineSearch} from "react-icons/ai";
import {FaMoon, FaSun} from "react-icons/fa";

export default function Navbar() {
    const bg = useColorModeValue("white", "gray.800");
    const mobileNav = useDisclosure();

    const {toggleColorMode: toggleMode} = useColorMode();
    const text = useColorModeValue("dark", "light");
    const SwitchIcon = useColorModeValue(FaMoon, FaSun);

    // Button bgColor
    const bgColor = useColorModeValue("blue.200", "blue.500");

    const [results, setResults] = useState([]);

    const handleSearch = async (query) => {
        // Example of searching using a hypothetical search API
        // Replace this with your actual search logic
        // const response = await fetch(`/api/search?q=${query}`);
        // const data = await response.json();
        // setResults(data.results);
    };

    return (
        <Box shadow="2xl" borderRadius="3xl">
            <chakra.header
                bg={bg}
                borderColor={useColorModeValue("gray.400", "blue.500")}
                borderBottomWidth={1}
                w="full"
                px={{base: 2, sm: 4}}
                py={4}
            >
                {/* MobileNav - setting */}
                <Flex alignItems="center" justifyContent="space-between" mx="auto">
                    <HStack spacing={4} display="flex" alignItems="center">
                        <Box display={{base: "inline-flex", md: "none"}}>
                            <IconButton
                                display={{base: "flex", md: "none"}}
                                aria-label="Open menu"
                                fontSize="20px"
                                color={useColorModeValue("gray.800", "inherit")}
                                variant="solid"
                                icon={<AiOutlineMenu/>}
                                onClick={mobileNav.onOpen}
                            />
                            <VStack
                                pos="absolute"
                                top={0}
                                left={0}
                                right={0}
                                display={mobileNav.isOpen ? "flex" : "none"}
                                flexDirection="column"
                                p={2}
                                pb={4}
                                m={2}
                                bg={bg}
                                spacing={3}
                                rounded="sm"
                                shadow="sm"
                            >
                                <CloseButton
                                    aria-label="Close menu"
                                    justifySelf="self-start"
                                    onClick={mobileNav.onClose}
                                />

                                <WalletModel/>
                                <IconButton
                                    bg={bgColor}
                                    borderRadius="2xl"
                                    size="md"
                                    w={90}
                                    fontSize="lg"
                                    aria-label={`Switch to ${text} mode`}
                                    variant="solid"
                                    color="current"
                                    ml={{base: "0", md: "3"}}
                                    onClick={toggleMode}
                                    icon={<SwitchIcon/>}
                                />
                            </VStack>
                        </Box>
                        <chakra.a
                            href="/"
                            title="wed3.0"
                            display="flex"
                            alignItems="center"
                        >
                            {/* <Logo /> */}
                            <VisuallyHidden>NCW Starter</VisuallyHidden>
                        </chakra.a>
                        <chakra.h1 fontWeight="semibold" fontSize="2xl">
                            NCW Starter
                        </chakra.h1>
                    </HStack>
                    <HStack spacing={3} display="flex" alignItems="center">
                        <HStack spacing={3} display={{base: "none", md: "inline-flex"}}>
                            <WalletModel/>

                            <IconButton
                                bg={bgColor}
                                borderRadius="2xl"
                                size="md"
                                fontSize="lg"
                                aria-label={`Switch to ${text} mode`}
                                variant="solid"
                                color="current"
                                ml={{base: "0", md: "3"}}
                                onClick={toggleMode}
                                icon={<SwitchIcon/>}
                            />
                        </HStack>
                        <chakra.a
                            p={3}
                            color={useColorModeValue("gray.800", "inherit")}
                            rounded="sm"
                            _hover={{color: useColorModeValue("gray.800", "gray.600")}}
                        ></chakra.a>
                    </HStack>
                </Flex>
            </chakra.header>

            {/* DesktopNav - setting */}
            <Flex
                alignItems="center"
                justifyContent="space-between"
                mx={2}
                borderWidth={0}
                overflowX="auto"
            >
                <Tabs defaultIndex={1} borderBottomColor="transparent">
                    <TabList>
                        <Tab
                            fontWeight="semibold"
                            py={4}
                            m={0}
                            _focus={{boxShadow: "none"}}
                        >
                            Search
                        </Tab>
                        <Tab
                            fontWeight="semibold"
                            py={4}
                            m={0}
                            _focus={{boxShadow: "none"}}
                        >
                            Register
                        </Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel width="1000px">
                            <Box p={4} width="100%">
                                <Heading color="blue.400">Website Search</Heading>
                                <SearchBar onSearch={handleSearch}/>
                                <List spacing={3} mt={4}>
                                    {results.map((result, index) => (
                                        <ListItem key={index}>
                                            <Link href={result.url} isExternal color="blue.400">
                                                {result.title}
                                            </Link>
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </Flex>
        </Box>
    );
}
