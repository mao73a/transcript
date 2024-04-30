const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const { exec } = require('child_process');
const config = require('./config');
const favicon = require('serve-favicon');
const utils = require('./utils');
const ai = require('./ai');



const markdown = require( "markdown" ).markdown;

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

const appRoute = `/${config.applicationName}`;
const port = 3000;

// Start the server
const server = app.listen(port, () => {
   console.log(`Server is running on port ${port}`);
  });
  


// Configure multer storage
const storage = multer.diskStorage({
 destination: function(req, file, cb) {
    cb(null, 'uploads/');
 },
 filename: function(req, file, cb) {
   const ext = path.extname(file.originalname);
   const uniqueFileName = `${Date.now()}${ext}`;
   cb(null, uniqueFileName); 
 }
});

const upload = multer({ storage: storage });


  
// Route for uploading files
app.post(appRoute+'/upload', upload.single('file'), async (req, res) => {
   try {
      // Assuming the uploaded file is saved in 'uploads/' directory
      const filePath = path.join(__dirname, 'uploads', req.file.filename);
      const taskid =  req.file.filename.match(/^\d+/)[0]; 
      const md5 = await utils.calculateMD5(filePath);
      const cachedTaskId = await utils.doIKnowThisMD5(md5);
      if (cachedTaskId){
         utils.removeAudioFiles();
         res.json({ status:"FOUND_IN_CACHE" , message: 'Uploading complete', filename : '', taskid : cachedTaskId});         
      } else {
         await utils.storeMD5(md5, taskid);
         const outputFile = utils.removeExtension(filePath) + '.ogg';
         const command = 'ffmpeg -i "'+filePath+'" -vn -map_metadata -1 -ac 1 -c:a libopus -b:a 24k -application voip '+outputFile;

         // Execute the command
         exec(command, async (error) => {
            if (error) {
               await res.status(500).json({ status :'ERROR', message: 'Compress error '+error});  
            }
            else { 
               console.log('upload OK');
               await res.json({ status:"OK" , message: 'Uploading complete', filename : outputFile, taskid : taskid});         
            }
         });
      }
   } catch (error) {
      console.error('Error uploading the file:', error);
      res.status(500).json({ message: 'Error uploading file' });
   }
});




app.post(appRoute+'/transcribe', upload.none(),   async (req, res) => {
   const filePath = req.body.filename;
   if (!filePath) {
        return res.status(400).json({ message: 'transcribe: File path is required.' });
    }
   try {
      const transcriptionResult = await ai.transcribeAudio(filePath);
      res.json({
         status : "OK",
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

app.post(appRoute+'/summary', upload.none(),   async (req, res) => {
   try {
       var filePath = req.body.filename;
       const taskid = req.body.taskid;
       const summaryVersion = req.body.summaryVersion;
       if (taskid){
         filePath = path.join(__dirname, 'uploads', taskid)+'.txt'
       }
       else if (!filePath) {
           return res.status(400).json({ message: 'summary: File path is required.' });
       }
       const summary = await ai.summarize(filePath, summaryVersion);
        res.json({
           status : "OK",
           message: 'Summary complete.',
           text: markdown.toHTML(summary.text),
       });
   } catch (error) {
       console.error('Error summarizing file:', error);
       //res.status(500).json({ message: 'Error transcribing file', text:'' });
       res.json({
         status : 'ERROR',
         message: 'Summarize error.'
     });       
   }
});



app.post(appRoute+'/restore',upload.none(),  async (req, res) => {
   const taskid = req.body.taskid;
   if (!taskid) {
       return res.status(400).json({ message: 'restore: You must provide taskid.' });
   }
   try{  
      const file1  = await  utils.loadFile(path.join(__dirname, 'uploads', taskid)+'.txt');
      const file2  = await  utils.loadFile(path.join(__dirname, 'uploads', taskid)+'.sum1.txt');
      var date = new Date(parseInt(taskid));

      res.json({
         status : "OK",
         message: 'Odtworzone z historii z '+date.toLocaleString(),
         fulltext: markdown.toHTML(file1),
         summary: markdown.toHTML(file2)
      });
   } catch(error){
      console.error('/restore', error);
      res.json({
         status : "ERROR",
         message: 'Wystąpił problem. Prawdopodobnie plik został usunięty z serwera.',
         fulltext: error,
         summary: ''
      });
   }

});


app.get(appRoute+'/rebuild', (req, res) => {
   // Ensure this endpoint is secured and only accessible by authorized users
   exec('cd .. && git pull && cd src && npm install', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return res.status(500).send(`Error: ${error}`);
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
      res.send(`<pre>${stdout}</pre>`);
      server.close(() => {
         console.log('Process terminated');
         process.exit(0);
      });
 
   });
});

  
// Add this route to your app.js file
app.get(appRoute+'/ls', async (req, res) => {
   try {
       // Specify the directory
       const directoryPath = path.join(__dirname, 'uploads');
       const fileInfoText = await utils.listDirectoryFiles(directoryPath);
       res.send(`<pre>${fileInfoText}</pre>`);

   } catch (error) {
       console.error('Error listing files:', error);
       res.status(500).send('Failed to list files.');
   }
});

// Serve static files from the 'public' directory
app.use(appRoute+'/', express.static('public'));

app.get(appRoute+'/', (req, res) => {
   // Send the 'index.html' file as a response
   res.sendFile('public', 'index.html');
});

