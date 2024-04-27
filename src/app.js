const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI  = require('openai');
const app = express();
const { exec } = require('child_process');
const config = require('./config');
const favicon = require('serve-favicon');
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { HumanMessage, SystemMessage } = require("langchain-core/messages");
const { ChatOpenAI } = require("@langchain/openai");
const markdown = require( "markdown" ).markdown;

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

const appRoute = `/${config.applicationName}`;
const port = 3000;


// Initialize the OpenAI object
const openai = new OpenAI();


function removeExtension(filePath){
   str = filePath.replace(/ /g, "_")
   return str.replace(/\.[^/.]+$/, "");
}

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

function removeAudioFiles() {
   // Specify the directory you want to clean
   const directoryPath = path.join(__dirname, 'uploads');

   // Read the directory
   fs.readdir(directoryPath, (err, files) => {
       if (err) {
           console.error('Error reading directory:', err);
           return;
       }

       // Filter out .ogg, .mp3, and .m4a files
       const audioFiles = files.filter(file => {
           const ext = path.extname(file).toLowerCase();
           return ext === '.ogg' || ext === '.mp3' || ext === '.m4a'  || ext === '.mp4';
       });

       // Delete each file
       audioFiles.forEach(file => {
           const filePath = path.join(directoryPath, file);
           fs.unlink(filePath, err => {
               if (err) {
                   console.error(`Error deleting file ${file}:`, err);
               } else {
                   console.log(`Deleted file ${file}`);
               }
           });
       });
   });
}

async function transcribeAudio(filePath) {
   try {
      // Transcribe the file using OpenAI Whisper-1
      const transcription = await openai.audio.transcriptions.create({
         file: fs.createReadStream(filePath),
         model: "whisper-1",
         language: "pl"
      });
      outputFilePath = removeExtension(filePath) + '.txt';
      fs.writeFileSync(outputFilePath, transcription.text);
      removeAudioFiles();
      console.log('transcribeAudio: File transcription saved to ' + outputFilePath);      
      return  {status:'OK', fulltext : markdown.toHTML("### Transkrypcja \n"+transcription.text), filename : outputFilePath};

   } catch (error) {
      console.error('transcribeAudio: Error transcribing file:', error);
      return {status:'ERROR', fulltext:'', filename:''};
   }
}  

async function summarize(filePath, res){
   try {
      const loader = new TextLoader(filePath);
      const [doc] = await loader.load();
      const chat = new ChatOpenAI({
         modelName: 'gpt-3.5-turbo',
         temperature: 0.7,
         max_tokens:5000
     });
      const { content } = await chat.invoke([
         new SystemMessage(`Analizuję zapis spotkania działowego, aby utworzyć dokument, który będzie zawierał wszystkie istotne informacje poruszone podczas spotkania. Mówię tylko prawdę. Wymieniam wszystkie tematy omówione w czasie spotkania. Identyfikuję wszystkie wzmianki o wykonanych zadaniach, planach pracy i kwestiach mogących wpłynąć na projekt, a następnie uporządkuję te informacje w odpowiednich sekcjach: 
         - ### Podsumowanie 
         - ### Zadania wykonane 
         - ### Zadania do wykonania 
         - ### Tematy do analizy
         - ### Problemy personalne
         Jeśli w rozmowie padły wzmianki na tematy nieobecności lub niedostępności pracowników, umieszczę je w sekcji "Problemy personalne". Jeśli nie było takich wzmianek, to nie generuję sekcji ### Problemy personalne.
         Jeśli stwierdzę że w czasie spotkania poruszono tematy niepasujące do powyższych sekcji, to wspomnę o nich w sekcji ### Pozostałe.
         Ignoruję uwagi dotyczące nagrywania spotkania.
         Wynik powienin być w formacie markdown.
         Zaczynamy! `
         ),
         new HumanMessage(
            doc.pageContent
         ),
     ]);
     outputFilePath = removeExtension(filePath) + '.sum1.txt';
     fs.writeFileSync(outputFilePath, content);
     console.log('summarize: Summary saved to ' + outputFilePath);
     return {status:'OK', text : content,  message: 'Summary complete.'};
    
   } catch (error) {
      console.error('summarize: Error making summary:', error);      
     return {status:'ERROR',  text : '', message: 'Summary error '+error};
   }
}

// Route for uploading files
app.post(appRoute+'/upload', upload.single('file'), async (req, res) => {
   try {
      console.log('upload1');
      // Assuming the uploaded file is saved in 'uploads/' directory
      const filePath = path.join(__dirname, 'uploads', req.file.filename);
      const taskid =  req.file.filename.match(/^\d+/)[0]; 
      const outputFile = removeExtension(filePath) + '.ogg';
      const command = 'ffmpeg -i "'+filePath+'" -vn -map_metadata -1 -ac 1 -c:a libopus -b:a 24k -application voip '+outputFile;

      // Execute the command
      exec(command, async (error, stdout, stderr) => {
         if (error) {
            await res.status(500).json({ status :'ERROR', message: 'Compress error '+error});  
         }
         else { 
            console.log('upload OK');
            await res.json({ status:"OK" , message: 'Uploading complete', filename : outputFile, taskid : taskid});         
         }
       });
   } catch (error) {
      console.error('Error uploading the file:', error);
      res.status(500).json({ message: 'Error uploading file' });
   }
});




app.post(appRoute+'/transcribe', upload.none(),   async (req, res) => {
   try {
       const filePath = req.body.filename;
      if (!filePath) {
           return res.status(400).json({ message: 'transcribe: File path is required.' });
       }
      const transcriptionResult = await transcribeAudio(filePath);
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
       if (taskid){
         filePath = path.join(__dirname, 'uploads', taskid)+'.txt'
       }
       else if (!filePath) {
           return res.status(400).json({ message: 'summary: File path is required.' });
       }
       const summary = await summarize(filePath);
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


async function loadFile(filepath){
      const loader = new TextLoader(filepath);
      const [doc] = await loader.load();
      doc.pageContent;
      return doc.pageContent;
};

app.post(appRoute+'/restore',upload.none(),  async (req, res) => {
   const taskid = req.body.taskid;
   if (!taskid) {
       return res.status(400).json({ message: 'restore: You must provide taskid.' });
   }
   try{  
      const file1  = await  loadFile(path.join(__dirname, 'uploads', taskid)+'.txt');
      const file2  = await  loadFile(path.join(__dirname, 'uploads', taskid)+'.sum1.txt');
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


// Serve static files from the 'public' directory
app.use(appRoute+'/', express.static('public'));

app.get(appRoute+'/', (req, res) => {
   // Send the 'index.html' file as a response
   res.sendFile('public', 'index.html');
});

// Start the server
app.listen(port, () => {
 console.log(`Server is running on port ${port}`);
});
