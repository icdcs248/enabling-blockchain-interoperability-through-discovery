// components/SearchBar.js
import { useState } from 'react';
import { Box, Input, Button, Stack } from '@chakra-ui/react';

const SearchBar = ({ onSearch }) => {
    const [query, setQuery] = useState('');

    const handleChange = (event) => {
        setQuery(event.target.value);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (query.trim()) {
            onSearch(query);
        }
    };

    return (
        <Box as="form" onSubmit={handleSubmit} width="100%">
            <Stack direction="row" spacing={4} align="center" width="100%">
                <Input
                    value={query}
                    onChange={handleChange}
                    placeholder="example.com"
                    flex="1"
                />
                <Button type="submit" bg="blue.200">
                    Search
                </Button>
            </Stack>
        </Box>
    );
};

export default SearchBar;
