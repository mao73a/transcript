document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const memo1 = document.getElementById('memo1');
  const memo2 = document.getElementById('memo2');
  const progressBarContainer = document.querySelector('.progress');
  const progressBar = document.querySelector('.progress-bar');


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
      if (file.type !== 'audio/mp4' && file.type !== 'audio/mpeg' &&
          file.type !== 'audio/x-m4a' && file.type !== 'video/mp4'){
          alert('Please drop an M4A, MP4, MP3 file only. ('+file.type+')');
          return;
      }

      const formData = new FormData();
      formData.append('file', file);

      // Show animation while uploading
      dropZone.textContent = 'Uploading...';
        {
          fetch('/transcript/upload', {
              method: 'POST',
              body: formData
          })
          .then((response) => {
            return  response.json();
          })
          .then((data) => {
            dropZone.textContent = data.message;

            const formData = new FormData();
            formData.append('filename', data.filename);
            dropZone.textContent = 'Saving speech to text...';
            return fetch('/transcript/transcribe', {
                method: 'POST',
                body: formData
              });      
          })
          .then((response) => {
            return  response.json();
          })
          .then((data) => {
            dropZone.textContent = 'Reading the shit...';
          })          
          .catch(function(error) {
            console.log('Error 2');
            dropZone.textContent = error;
            console.log(error);
          });
   
   
          return;
          let data;
          console.log(response);           
          if (response.ok) {
                 
              data = await response.json();

              dropZone.textContent = data.message;    
              formData.filename = data.filename;            
              const response = await fetch('/transcript/transcribe', {
                method: 'POST',
                body: formData
              });  
   
              if (response.ok) {

                data = await response.json();
                dropZone.textContent = data.message;    
                formData.filename = data.filename;    

                memo1.style.display = 'block';
                memo2.style.display = 'block';      
                memo1.textContent = data.text;
                memo2.textContent = 'todo';   
              } else {
                const text = await response.text();
                dropZone.textContent = `Error: ${text}`;               
              }    
          } else {
              const text = await response.text();
              dropZone.textContent = `Error: ${text}`;
              console.error(`Error: ${text}`);
          }

          memo1.style.display = 'block';
      }

     // dropZone.textContent = 'Drop M4A or MP3 file here';
  });
});

