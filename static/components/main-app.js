import Domo, {html} from '/app/domo.js';
import {StreamProcessor} from '/app/helpers/stream.js';

export class MainApp extends Domo {
  constructor(component) {
    super(component);
    this.firstRender = true;
  }

  getInitialState() {    
    this.setupStream()
    document.title = config.main.title;
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
        localStorage.setItem(config.app_name + '-email', this.state.email);
        this.handleMessageSubmission(config.prompts.save_settings.text);
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
    console.log(postData)
    this.processor.processStream(postData);
  }
  
  getMessages() {return this.state.messages}
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
      <p>
        <a href="/">← AdventAI 🎁</a>
      </p>
      <div style="display: flex">
        <generic-icon icon="${config.app_name}" style="margin-right: 1em " />
        <h1 style="flex:1">${config.main.title}</h1>
      </div>
      
      <p>${config.main.description}</p>
      <p>
        <a target="_blank" href="${config.main.github_link}">Clone this app</a> |
        <a target="_blank" href="https://app.toolhouse.ai/sign-up">Sign up for Toolhouse (it's free!)</a>
      </p>
      <preferences-form 
        data-hidden="${this.state.formIsHidden || this.state.configured || this.state.messages.length > 0}"
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
        data-hidden="${this.state.configured === false || this.firstRender}"
        cb-action-handler=${this.handleMessageSubmission}
      />
      <resizable-textarea 
        cb-enter-handler=${this.handleMessageSubmission} 
      />
    `;
  }
}