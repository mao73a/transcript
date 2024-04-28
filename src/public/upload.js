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
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      var taskid = 0;
      if (file.type !== 'audio/mp4' && file.type !== 'audio/mpeg' &&
          file.type !== 'audio/x-m4a' && file.type !== 'video/mp4'){
          alert('Please drop an M4A, MP4, MP3 file only. ('+file.type+')');
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
            dropZone.textContent = data.message;
            taskid = data.taskid;  
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
    dropZone.textContent = data.message;  
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

function regenerate(ptaskid){
  const dropZone = document.getElementById('drop-zone');  
  const memo2 = document.getElementById('memo2');
  dropZone.textContent = "Ponowne generowanie podsumowania..."
  const formData = new FormData();
  formData.append('taskid', ptaskid); 

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
