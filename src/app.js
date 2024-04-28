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
const crypto = require('crypto');


const markdown = require( "markdown" ).markdown;

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

const appRoute = `/${config.applicationName}`;
const port = 3000;

// Start the server
const server = app.listen(port, () => {
   console.log(`Server is running on port ${port}`);
  });
  


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


 

function calculateMD5(filename) {
 return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filename);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      const md5 = hash.digest('hex');
      resolve(md5);
    });

    stream.on('error', (error) => {
      reject(error);
    });
 });
}

function readJsonFile(filePath) {
   return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          // If the file does not exist or any other error occurs, resolve with an empty array
          resolve([]);
        } else {
          try {
              // Attempt to parse the JSON data
              const parsedData = JSON.parse(data);
              resolve(parsedData);
          } catch (error) {
              // If parsing fails (e.g., due to invalid JSON), resolve with an empty array
              resolve([]);
          }
        }
      });
   });
}

async function lookupTaskIdByMd5(md5, filePath) {
   const records = await readJsonFile(filePath);
   try{
      const record = await records.find(record => record.md5 === md5);
      return record.taskid;
   } catch(error){
      return null;
   }
}  

async function doIKnowThisMD5(md5){
   const database = path.join(__dirname, 'uploads', 'md5db.json');
   taskid = await lookupTaskIdByMd5(md5, database)
   return taskid;
}

async function storeMD5(md5, taskid){
   const database = path.join(__dirname, 'uploads', 'md5db.json');
   const records = await readJsonFile(database);
   records.push({md5: md5, taskid: taskid});
   fs.writeFileSync(database, JSON.stringify(records, null, 2));
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

function systemPrompt(version){
  if (version==2){
   return `You will be presented a meeting transcript. Your goal is to create the meeting summary.
   Guide to Writing a Structured, Insightful Meeting Summary
   Preparation:
   a. Review the meeting agenda and purpose.
   b. Thoroughly read the transcript to familiarize yourself with the content.
   Main Topics:
   a. Identify and outline the key topics discussed.
   b. Summarize each topic in a clear and concise manner, including:
       i. Relevant data or statistics.
       ii. Important quotations or statements.
       iii. Any related visuals or resources.
   Decisions Made:
   a. Clearly state any decisions reached during the meeting.
   b. Include the reasoning behind these decisions and any potential impact.
   Action Items:
   a. List any tasks or projects assigned during the meeting.
   b. Specify the responsible parties and deadlines for each action item.
   c. Highlight any dependencies or prerequisites.
   Areas for Further Discussion:
   a. Identify any unresolved issues or topics that require additional conversation.
   b. Note any differing opinions or potential obstacles.
   c. Suggest possible ways to address these concerns in future meetings.
   Follow-up Actions:
   a. List any follow-up meetings or events that were scheduled.
   b. Include any necessary preparations or resources for these follow-ups.
   c. Specify who is responsible for organizing and facilitating these actions.
   Conclusion:
   a. Summarize the main points and outcomes of the meeting.
   b. Reiterate any crucial decisions or action items.
   c. End with a positive statement or acknowledgment of progress made.
   Formatting Tips:
   a. Use clear headings and subheadings for easy navigation.
   b. Use bullet points or numbered lists for clarity and readability.
   c. Keep the summary concise, aiming for one to two pages in length.
   
   Act as a professional meeting summarizer and create a concise and insightful summary of a meeting transcript. Utilize the template structure provided to structure the summary in an organized and meaningful way, while also making sure to keep all the relevant information intact. Analyze the conversation for key takeaways, important decisions and action items, and summarize them into easy-to-digest points. Consider the objectives of the meeting and evaluate how far the conversation progressed towards achieving those objectives to ensure the summary is comprehensive yet succinct.
   Output result as markdown in Polish.`;
  }
 else if (version==3){
   return `I am reading meeting transcirpion in Polish. My goal is to:
   1. Read user document note any common topics or decisions.
   2. Identify the main points during the meeting.
   3. Create a new document that contains the main points.
   4. Add any unique information.
   5. Rearrange the sentences in the summary as necessary for clarity.
   6. Double-check the new summary against the original summaries to ensure no information has been lost.
   7. Output my results in markdown format in Polish.`;
 }
 else if (version=1){
   const currentDate = new Date().toLocaleDateString('en-GB').split('/').reverse().join('-');
   console.log(`  Dziś jest ${currentDate}`);
   return `Analizuję zapis spotkania działowego, aby utworzyć dokument, który będzie zawierał wszystkie istotne informacje poruszone podczas spotkania. Mówię tylko prawdę. Wymieniam wszystkie tematy omówione w czasie spotkania. Identyfikuję wszystkie wzmianki o wykonanych zadaniach, planach pracy i kwestiach mogących wpłynąć na projekt, a następnie uporządkuję te informacje w odpowiednich sekcjach: 
   - ### Podsumowanie 
   - ### Zadania wykonane 
   - ### Zadania do wykonania 
   - ### Tematy do analizy
   - ### Problemy personalne
   Jeśli w rozmowie padły wzmianki na tematy nieobecności lub niedostępności pracowników, umieszczę je w sekcji "Problemy personalne". Jeśli nie było takich wzmianek, to nie generuję sekcji ### Problemy personalne.
   Jeśli stwierdzę że w czasie spotkania poruszono tematy niepasujące do powyższych sekcji, to wspomnę o nich w sekcji ### Pozostałe.
   Ignoruję uwagi dotyczące nagrywania spotkania.
   Wynik powienin być w formacie markdown.
   ###
   Dziś jest ${currentDate}
   Zaczynamy! `;
  } else {
    throw new Error(`Incorrect prompt version ${version}`);
  }
}

async function summarize(filePath, version){
   try {
      const loader = new TextLoader(filePath);
      const [doc] = await loader.load();
      const chat = new ChatOpenAI({
         modelName: 'gpt-3.5-turbo',
         temperature: 0.7,
         max_tokens:5000
     });

      const { content } = await chat.invoke([
         new SystemMessage(systemPrompt(version)),
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
      // Assuming the uploaded file is saved in 'uploads/' directory
      const filePath = path.join(__dirname, 'uploads', req.file.filename);
      const taskid =  req.file.filename.match(/^\d+/)[0]; 
      const md5 = await calculateMD5(filePath);
      const cachedTaskId = await doIKnowThisMD5(md5);
      if (cachedTaskId){
         removeAudioFiles();
         res.json({ status:"FOUND_IN_CACHE" , message: 'Uploading complete', filename : '', taskid : cachedTaskId});         
      } else {
         await storeMD5(md5, taskid);
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
       const summaryVersion = req.body.summaryVersion;
       if (taskid){
         filePath = path.join(__dirname, 'uploads', taskid)+'.txt'
       }
       else if (!filePath) {
           return res.status(400).json({ message: 'summary: File path is required.' });
       }
       const summary = await summarize(filePath, summaryVersion);
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

       // Read the directory
       fs.readdir(directoryPath, (err, files) => {
           if (err) {
               console.error('Error reading directory:', err);
               return res.status(500).send('Failed to read directory.');
           }

           let fileInfoArray = [];

           files.forEach(file => {
               const filePath = path.join(directoryPath, file);
               // Get file stats (size, modification date, etc.)
               fs.stat(filePath, (err, stats) => {

                   fileInfoArray.push({
                       name: file,
                       size: stats.size, // size in bytes
                       date: stats.mtime // modification date
                    });

                   if (fileInfoArray.length === files.length) {
                       fileInfoArray.sort((a, b) => b.date - a.date);

                       let fileInfoText = fileInfoArray.map(fileInfo => {
                           const formattedDate = fileInfo.date.toLocaleString('en-GB', {
                               day: '2-digit',
                               month: '2-digit',
                               year: 'numeric',
                               hour: '2-digit',
                               minute: '2-digit',
                               second: '2-digit'
                            });
                           return `${fileInfo.name} \t ${fileInfo.size} bytes \t ${formattedDate}`;
                       }).join('\n');

                       res.send(`<pre>${fileInfoText}</pre>`);
                   }
               });
           });
       });
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

