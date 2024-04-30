const { TextLoader } = require("langchain/document_loaders/fs/text");
const { HumanMessage, SystemMessage } = require("langchain-core/messages");
const { ChatOpenAI } = require("@langchain/openai");
const fs = require('fs');
const utils = require('./utils');
const OpenAI  = require('openai');
const markdown = require( "markdown" ).markdown;

// Initialize the OpenAI object
const openai = new OpenAI();

async function transcribeAudio(filePath) {
    try {
       // Transcribe the file using OpenAI Whisper-1
       const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: "whisper-1",
          language: "pl"
       });
       const outputFilePath = utils.removeExtension(filePath) + '.txt';
       fs.writeFileSync(outputFilePath, transcription.text);
       utils.removeAudioFiles();
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
  else if (version==1){
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
      const outputFilePath = utils.removeExtension(filePath) + '.sum1.txt';
      fs.writeFileSync(outputFilePath, content);
      console.log('summarize: Summary saved to ' + outputFilePath);
      return {status:'OK', text : content,  message: 'Summary complete.'};
     
    } catch (error) {
       console.error('summarize: Error making summary:', error);      
      return {status:'ERROR',  text : '', message: 'Summary error '+error};
    }
 }


 module.exports = {
    transcribeAudio,
    summarize
 } ;
