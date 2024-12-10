import Domo, {html} from '/domo.js';
import {StreamProcessor} from '/helpers/stream.js';

export class MainApp extends Domo {
  constructor(component) {
    super(component);
    this.firstRender = true;
  }

  getInitialState() {    
    this.setupStream()
    const state = { 
      messages: [], 
      thinking: false,
      streamingResponse: '',
      formIsHidden: false,
      email: localStorage.getItem(config.app_name + '-email') ?? '',
      configured: !!localStorage.getItem(config.app_name + '-configured') || false,
    };

    return state
  }

  setupStream() {
    this.processor = new StreamProcessor('/api/chat');
    this.processor.addEventListener('chunk', (event) => {
      this.setState({thinking: false, streamingResponse: this.state.streamingResponse + event.detail})
    });
    
    this.processor.addEventListener('end', (event) => {
      const messages = JSON.parse(event.detail);
      const lastMessage = JSON.stringify(messages.at(-1));
      this.setState({streamingResponse : '', messages: messages});
      if (lastMessage.includes('<valid/>')) {
        this.handleMessageSubmission(config.prompts.save_settings.text);
        localStorage.setItem(config.app_name + '-email', this.state.email);
      } else if (lastMessage.includes('<stored/>')) {
        localStorage.setItem(config.app_name + '-configured', 'true');
        this.setState({ configred: true });
      }
    });

    // TODO: implement error
    // this.processor.addEventListener('error', (event) => {
    //   // console.error('Error occurred:', event.detail);
    // });
  }

  handleMessageSubmission(value) {
    if (value.trim().length === 0) {
      return
    }
    const messages = this.state.messages;
    messages.push({ "role": "user", "content": value.trim()})
    this.setState({messages: messages, thinking: true});

    const postData = {
      messages: this.state.messages,
    };

    if (localStorage.getItem(config.app_name + '-email')) {
      postData.email = localStorage.getItem(config.app_name + '-email');
    }
    
    this.processor.processStream(postData);
  }
  
  getMessages() {return this.state.messages}
  // getMessages() {return [{"role": "user", "content": "Validate the following details.\n- Check that the following is a valid email: daniele@test.com\n- Check that the following are valid meal preferences: vegetarian\n  \nIf all look good to you, respond with <valid/>. If something does not look right, let me know what the errors are. Respond with errors in <errors></errors> tags. Do not store these details until I explicitly tell you do to so."}, {"role": "assistant", "content": [{"text": "Let me check these details:\n\n1. Email validation (daniele@test.com):\n   - Contains @ symbol\n   - Has valid format with username and domain\n   - Has proper domain structure (.com)\n   This is a properly formatted email address.\n\n2. Meal preference (vegetarian):\n   - \"Vegetarian\" is a standard, well-recognized dietary preference\n   - It clearly indicates a specific type of diet\n   This is a valid meal preference.\n\nSince both the email format and the meal preference are valid:\n\n<errors>", "type": "text"}]}];}
  getStreamingResponse() {return this.state.streamingResponse}
  thinking() {return this.state.thinking}

  submitPreferences({ email, preferences }) {
    const prompt = config.prompts.check_settings.text
      .replace('{email}', email)
      .replace('{preferences}', preferences);
    this.setState({ formIsHidden: true, email: email });
    this.handleMessageSubmission(prompt);
  }

  componentDidRender() {
    this.firstRender = false;
  }
  
  render() {
    return html`
      <div style="display: flex">
        <generic-icon icon="${config.app_name}" style="margin-right: 1em " />
        <h1 style="flex:1">${config.main.title}</h1>
      </div>
      
      <p>${config.main.description}</p>
      <preferences-form 
        data-hidden="${this.state.formIsHidden || this.state.configured}"
        cb-submit=${this.submitPreferences}
      />
      ${this.state.configured && this.firstRender ? `<success-message />` : ''}
      <chat-history-container 
        data-provider="${config.main.model.indexOf('claude') > -1 ? 'anthropic' : 'openai'}"
        data-len="${this.state.messages.length}" 
        cb-thinking=${this.thinking} 
        cb-get-history=${this.getMessages} 
        cb-get-stream=${this.getStreamingResponse}
      />
      <action-box 
        class="${this.firstRender ? 'fade-slide' : 'fade-out'}"
        data-hidden="${this.state.configured === false || this.firstRender === false}"
        cb-action-handler=${this.handleMessageSubmission}
      />
      <resizable-textarea 
        cb-enter-handler=${this.handleMessageSubmission} 
      />
    `;
  }
}