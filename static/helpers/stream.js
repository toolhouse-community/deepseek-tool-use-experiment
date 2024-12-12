export class StreamProcessor extends EventTarget {
  constructor(url) {
    super();
    this.url = url;
  }
  
  async processStream(postData) {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
      });
      
      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      const stream = new ReadableStream({
        start: async (controller) => {
          try {
            let isStreamActive = true;
            while (isStreamActive) {
              try {
                const { done, value } = await reader.read();
                
                if (done) {
                  isStreamActive = false;
                  break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                
                // Look for complete event pairs (data + event)
                while (true) {
                  const eventIndex = buffer.indexOf('event:');
                  if (eventIndex === -1) break;
                  
                  // Find the next double newline after 'event:'
                  const endIndex = buffer.indexOf('\n\n', eventIndex);
                  if (endIndex === -1) break;
                  
                  // Extract the complete event pair
                  const eventPair = buffer.substring(0, endIndex + 2);
                  buffer = buffer.substring(endIndex + 2);
                  
                  // Parse the event pair
                  const dataMatch = eventPair.match(/data:([\s\S]*?)(?=\nevent:)/);
                  const eventMatch = eventPair.match(/event: (\w+)/);
                  
                  if (dataMatch && eventMatch) {
                    const eventData = dataMatch[1];
                    const eventType = eventMatch[1];
                    
                    // Emit custom event
                    const customEvent = new CustomEvent(eventType, {
                      detail: eventData
                    });
                    this.dispatchEvent(customEvent);
                    
                    if (eventType === 'chunk') {
                      controller.enqueue(eventData);
                    } else if (eventType === 'end') {
                      isStreamActive = false;
                      break;
                    }
                  }
                }
              } catch (readError) {
                if (readError.message.includes('reader has been released')) {
                  isStreamActive = false;
                  break;
                }
                throw readError;
              }
            }
            
            controller.close();
            if (!reader.closed) {
              reader.releaseLock();
            }
          } catch (error) {
            controller.error(error);
            if (!reader.closed) {
              reader.releaseLock();
            }
            const errorEvent = new CustomEvent('error', {
              detail: error
            });
            this.dispatchEvent(errorEvent);
          }
        },
        
        cancel() {
          if (!reader.closed) {
            reader.releaseLock();
          }
        }
      });

      if (window.onbeforeunload) {
        window.onbeforeunload(() => stream.cancel());
      }
      
      return stream;
    } catch (error) {
      const errorEvent = new CustomEvent('error', {
        detail: error
      });
      this.dispatchEvent(errorEvent);
      throw error;
    }
  }
}