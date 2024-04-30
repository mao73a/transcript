const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { TextLoader } = require("langchain/document_loaders/fs/text");

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

async function loadFile(filepath){
    const loader = new TextLoader(filepath);
    const [doc] = await loader.load();
    doc.pageContent;
    return doc.pageContent;
};


async function listDirectoryFiles(directoryPath)
{
    return new Promise((resolve, reject) => {
       // Read the directory
       fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            reject('Failed to read directory.');
            return;
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

                    resolve(fileInfoText);
                }
            });
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
      return new Promise((resolve) => {
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
      const taskid = await lookupTaskIdByMd5(md5, database)
      return taskid;
   }
   
   async function storeMD5(md5, taskid){
      const database = path.join(__dirname, 'uploads', 'md5db.json');
      const records = await readJsonFile(database);
      records.push({md5: md5, taskid: taskid});
      fs.writeFileSync(database, JSON.stringify(records, null, 2));
   }

   function removeExtension(filePath){
    const str = filePath.replace(/ /g, "_")
    return str.replace(/\.[^/.]+$/, "");
 }
   

 module.exports = {
    removeAudioFiles,
    removeExtension,
    loadFile,
    listDirectoryFiles,
    calculateMD5,
    storeMD5,
    doIKnowThisMD5
   };