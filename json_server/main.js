const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const jsonDirectory = path.join(__dirname, 'spec_files');

app.get('/json/:filename', (req, res) => {
	const filename = req.params.filename;
	const filepath = path.join(jsonDirectory, filename);

	fs.access(filepath, fs.constants.F_OK, (err) => {
		if (err) {
			return res.status(404).json({ error: 'File not found' });
		}

		res.sendFile(filepath);
	});
});

app.listen(PORT, () => {
	console.log(`JSON server listening to port ${PORT}`);
});
