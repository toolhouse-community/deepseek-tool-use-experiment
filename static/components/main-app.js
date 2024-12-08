import Domo, {html} from '/domo.js';
import {StreamProcessor} from '/lib/stream.js';

export class MainApp extends Domo {
  constructor(component) {
    super(component);
  }

  getInitialState() {
    this.process()

    return { 
      messages: [
        {
          role: 'user',
          message: 'hello'
        },
        {
          role: 'assistant',
          message: 'world',
        }
      ], 
      streamingResponse: ''
    };
  }

  async messageCallback(value) {
    console.log(value.trim())
  }

  
  process() {
    // Usage example:
    const processor = new StreamProcessor('https://0.0.0.0:8000/api/chat');
    
    // Add event listeners
    processor.addEventListener('chunk', (event) => {
      // console.log('Chunk received:', event.detail);
      this.setState({streamingResponse: this.state.streamingResponse + event.detail})
    });
    
    processor.addEventListener('end', (event) => {
      console.log('Stream ended:', JSON.parse(event.detail));
      this.setState({streamingResponse : '', messages: JSON.parse(event.detail)})
    });
    
    processor.addEventListener('error', (event) => {
      // console.error('Error occurred:', event.detail);
    });
    
    // Start processing with some data
    const postData = {
      model: 'claude-3-5-sonnet-latest',
      messages: [
        {"role": "user", "content": "hello, can you tell me a little bit about you?"}
      ]
    };
    
    // Process the stream and collect results
    processor.processStream(postData)
    .then(stream => {
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        stream.pipeTo(new WritableStream({
          write(chunk) {
            chunks.push(chunk);
          },
          close() {
            resolve(chunks);
          },
          abort(err) {
            reject(err);
          }
        }));
      });
    })
    .then(results => {
      // console.log('All chunks processed:', results);
    })
    .catch(error => {
      // console.error('Stream processing failed:', error);
    });
  }
  
  getMessages() {return this.state.messages}
  getStreamingResponse() {return this.state.streamingResponse}
  
  render() {
    return html`
      <chat-history-container cb-get-history=${this.getMessages} cb-get-stream=${this.getStreamingResponse}/>
      <resizable-textarea cb-enter-handler=${this.messageCallback} />
    `;
  }
}