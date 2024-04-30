const appRoute = `/${config.applicationName}`;

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const memo1 = document.getElementById('memo1');
  const memo2 = document.getElementById('memo2');

  dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
      const memo1Text = document.getElementById('memo1Text');
      const memo2Text = document.getElementById('memo2Text');      
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      var taskid = 0;
      if (file.type !== 'audio/mp4' && file.type !== 'audio/mpeg' &&
          file.type !== 'audio/x-m4a' && file.type !== 'video/mp4'){
          alert('Tylko pliki: M4A, MP4, MP3. Twój plik to '+file.type);
          return;
      }

      const formData = new FormData();
      formData.append('file', file);


      dropZone.textContent = 'Przesyłam plik...';
        {
          fetch(appRoute+'/upload', {
              method: 'POST',
              body: formData
          })
          .then((response) => {
            return  response.json();
          })
          .then((data) => {
            taskid = data.taskid;             
            if(data.status == 'FOUND_IN_CACHE'){
              restore(taskid);
              SetTaskId(taskid);
              throw new Error('Data found in cache.');
            }
            dropZone.textContent = data.message;
 
            const formData = new FormData();
            formData.append('filename', data.filename);
            dropZone.textContent = 'Przetwarzam mowę na tekst...';
            return fetch(appRoute+'/transcribe', {
                method: 'POST',
                body: formData
              });      
          })
          .then((response) => {
            return  response.json();
          })
          .then((data) => {
            const formData = new FormData();
            formData.append('filename', data.filename);        
            formData.append('summaryVersion',1);    
            dropZone.textContent = 'Generowanie podsumowania...';
            memo1.style.display = 'block';
            memo2.style.display = 'block';              
            memo1Text.innerHTML = data.text;            
            memo2Text.textContent = "Analiza tekstu..."   
            return fetch(appRoute+'/summary', {
              method: 'POST',
              body: formData
            });                
          })    
          .then((response) => {
            return  response.json();
          })   
          .then((data) => {

            dropZone.textContent = data.message;  
            SetTaskId(taskid);
            dropZone.innerHTML = 'Gotowe. <a href="' + appRoute + '/index.html?taskid=' + taskid + '">Link do tego podsumowania.</a>';
            memo1.style.display = 'block';
            memo2.style.display = 'block';      
            memo2Text.innerHTML = data.text;            
          })                          
          .catch(function(error) {
            console.log('Error 2');
            dropZone.textContent = error;
            console.log(error);
          });

      }

     // dropZone.textContent = 'Drop M4A or MP3 file here';
  });
});


function restore(taskid){
  const dropZone = document.getElementById('drop-zone');
  const memo1 = document.getElementById('memo1');
  const memo2 = document.getElementById('memo2');
  const memo1Text = document.getElementById('memo1Text');
  const memo2Text = document.getElementById('memo2Text');    
  const formData = new FormData();

  dropZone.textContent = "Ładuje dane historyczne..."
  formData.append('taskid', taskid);

  fetch(appRoute+'/restore', {
    method: 'POST',
    body: formData
  })
  .then((response) => {
    return  response.json();
  })   
  .then((data) => {
    dropZone.innerHTML = data.message+'. <a href="' + appRoute + '/index.html?taskid=' + taskid + '">Link do tego podsumowania.</a>';
 
    memo1.style.display = 'block';
    memo2.style.display = 'block';              
    memo1Text.innerHTML = data.fulltext;            
    memo2Text.innerHTML = data.summary;  
  })
  .catch(function(error) {
    dropZone.textContent = error;
    console.log(error);
  });  

};

function SetTaskId(taskid){
  document.getElementById("_taskid").textContent = taskid;  
}

function GetTaskId(taskid){
  return document.getElementById("_taskid").textContent;
}

function regenerate(ptaskid, summaryVersion){
  const dropZone = document.getElementById('drop-zone');  
  const memo2Text = document.getElementById('memo2Text');
  dropZone.textContent = "Ponowne generowanie podsumowania..."
  const formData = new FormData();
  formData.append('taskid', ptaskid); 
  formData.append('summaryVersion',summaryVersion);

  fetch(appRoute+'/summary', {
      method: 'POST',
      body: formData
    })
  .then((response) => {
    return  response.json();
  })   
  .then((data) => {
    dropZone.textContent = data.message;  
    dropZone.innerHTML = 'Gotowe. <a href="' + appRoute + '/index.html?taskid=' + ptaskid + '">Link do tego podsumowania.</a>';
    memo2Text.innerHTML = data.text;            
  })                          
  .catch(function(error) {
    console.log('Error 4');
    dropZone.textContent = error;
    console.log(error);
  });
}
