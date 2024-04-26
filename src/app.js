const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI  = require('openai');
const app = express();
const { exec } = require('child_process');

const favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

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


async function transcribeAudio(filePath, res) {
   try {
      // Transcribe the file using OpenAI Whisper-1
      const transcription = await openai.audio.transcriptions.create({
         file: fs.createReadStream(filePath),
         model: "whisper-1",
         language: "pl"
      });
      outputFilePath = filePath + '.txt';
      fs.writeFileSync(outputFilePath, transcription.text);
      res = {status:'OK', fulltext : transcription.text, filename : outputFilePath};
      console.log('File transcription saved to ' + outputFilePath);
   } catch (error) {
      res = {status:'ERROR'};
      console.error('Error transcribing file:', error);
   }
}  

// Route for uploading files
app.post('/transcript/upload', upload.single('file'), async (req, res) => {
   try {
      console.log('upload1');
      // Assuming the uploaded file is saved in 'uploads/' directory
      const filePath = path.join(__dirname, 'uploads', req.file.filename);
      const outputFile = filePath+'.ogg';
      const command = 'ffmpeg -i '+filePath+' -vn -map_metadata -1 -ac 1 -c:a libopus -b:a 24k -application voip '+outputFile;

      // Execute the command
      exec(command, async (error, stdout, stderr) => {
         if (error) {
            await res.status(500).json({ status :'ERROR', message: 'Compress error '+error});  
         }
         else { 
            console.log('upload OK');
            await res.json({ status:"OK" , message: 'Uploading complete', filename : outputFile});         
         }
       });
   } catch (error) {
      console.error('Error uploading the file:', error);
      res.status(500).json({ message: 'Error uploading file' });
   }
});



app.post('/transcript/transcribe', upload.none(),   async (req, res) => {
   try {
       const filePath = req.body.filename;
       if (!filePath) {
           return res.status(400).json({ message: 'transcribe: File path is required.' });
       }
      const transcriptionResult = await transcribeAudio(filePath);
        res.json({
           status : transcriptionResult.fulltext,
           filename : transcriptionResult.filename,
           message: 'Transcription complete.',
           text: transcriptionResult.fulltext,
       });
   } catch (error) {
       console.error('Error transcribing file:', error);
       //res.status(500).json({ message: 'Error transcribing file', text:'' });
       res.json({
         status : 'ERROR',
         message: 'Transcription error.'
     });       
   }
});

app.post('/transcript/test', (req, res) => {
   res.json({

      message: 'Transcription complete.'
  }); 
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
