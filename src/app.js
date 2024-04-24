const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI  = require('openai');
const app = express();
const { exec } = require('child_process');

const port = 3000;


// Initialize the OpenAI object
const openai = new OpenAI();

// Configure multer storage
const storage = multer.diskStorage({
 destination: function(req, file, cb) {
    cb(null, 'uploads/');
 },
 filename: function(req, file, cb) {
    cb(null, file.originalname);
 }
});

const upload = multer({ storage: storage });

// Mock processing function
function processFile(filePath) {
 // Simulate processing time
 return new Promise((resolve) => {
    setTimeout(() => {
      resolve('Processing complete');
    }, 2000);
 });
}


async function transcribeAudio(filePath) {
   try {
      // Transcribe the file using OpenAI Whisper-1
      const transcription = await openai.audio.transcriptions.create({
         file: fs.createReadStream(filePath),
         model: "whisper-1",
      });
      outputFilePath = filePath + '.txt';
      fs.writeFileSync(outputFilePath, transcription.text);
      console.log('File transcription saved to ' + outputFilePath);
   } catch (error) {
      console.error('Error transcribing file:', error);
   }
}  

// Route for uploading files
app.post('/transcript/upload', upload.single('file'), async (req, res) => {
   try {
      // Assuming the uploaded file is saved in 'uploads/' directory
      const filePath = path.join(__dirname, 'uploads', req.file.filename);
      res.json({ message: 'Transcription in progress...' });

      const command = 'ffmpeg -i '+filePath+' -vn -map_metadata -1 -ac 1 -c:a libopus -b:a 12k -application voip '+filePath+'.ogg';

      // Execute the command
      exec(command, (error, stdout, stderr) => {
         if (error) {
             console.error(`exec error: ${error}`);
             return;
         }
         console.log(`stdout: ${stdout}`);
         console.error(`stderr: ${stderr}`);
         transcribeAudio(filePath+'.ogg');
       });
     

   } catch (error) {
      console.error('Error transcribing file:', error);
      res.status(500).json({ message: 'Error transcribing file' });
   }
});

// Serve static files from the 'public' directory
app.use('/transcript', express.static('public'));

app.get('/transcript', (req, res) => {
   // Send the 'index.html' file as a response
   res.sendFile('public', 'index.html');
});

// Start the server
app.listen(port, () => {
 console.log(`Server is running on port ${port}`);
});
