import Domo, {html} from '/domo.js';
import {StreamProcessor} from '/lib/stream.js';

export class MainApp extends Domo {
  constructor(component) {
    super(component);
  }

  getInitialState() {
    this.setupStream()

    return { 
      messages: [], 
      thinking: false,
      streamingResponse: ''
    };
  }

  setupStream() {
    // Usage example:
    this.processor = new StreamProcessor('https://0.0.0.0:8000/api/chat');
    
    // Add event listeners
    this.processor.addEventListener('chunk', (event) => {
      // console.log('Chunk received:', event.detail);
      this.setState({thinking: false, streamingResponse: this.state.streamingResponse + event.detail})
    });
    
    this.processor.addEventListener('end', (event) => {
      console.log('Stream ended:', JSON.parse(event.detail));
      this.setState({streamingResponse : '', messages: JSON.parse(event.detail)})
    });
    
    this.processor.addEventListener('error', (event) => {
      // console.error('Error occurred:', event.detail);
    });
  }

  handleMessageSubmission(value) {
    if (value.trim().length === 0) {
      return
    }
    const messages = this.state.messages;
    messages.push({ "role": "user", "content": value.trim()})
    this.setState({messages: messages, thinking: true});
    // Start processing with some data
    const postData = {
      model: 'claude-3-5-sonnet-latest',
      messages: this.state.messages
    };
    
    // Process the stream and collect results
    this.processor.processStream(postData)
    // .then(stream => {
    //   const chunks = [];
      
    //   return new Promise((resolve, reject) => {
    //     stream.pipeTo(new WritableStream({
    //       write(chunk) {
    //         chunks.push(chunk);
    //       },
    //       close() {
    //         resolve(chunks);
    //       },
    //       abort(err) {
    //         reject(err);
    //       }
    //     }));
    //   });
    // })
    // .then(results => {
    //   // console.log('All chunks processed:', results);
    // })
    // .catch(error => {
    //   // console.error('Stream processing failed:', error);
    // });
  }
  
  getMessages() {return this.state.messages}
  getStreamingResponse() {return this.state.streamingResponse}
  thinking() {return this.state.thinking}
  
  render() {
    return html`
      <chat-history-container data-len="${this.state.messages.length}" cb-thinking=${this.thinking} cb-get-history=${this.getMessages} cb-get-stream=${this.getStreamingResponse}/>
      <resizable-textarea cb-enter-handler=${this.handleMessageSubmission} />
    `;
  }
}