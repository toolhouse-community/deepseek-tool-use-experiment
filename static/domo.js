const html = (strings, ...expressions) => {
  let result = '';
  
  strings.forEach((string, i) => {
    // Add the string part
    result += string;
    
    // If there's a corresponding expression
    if (i < expressions.length) {
      if (expressions[i] instanceof Function) {
        const fnName = expressions[i].name || `callback_${Math.random().toString(36).substr(2, 9)}`;
        result += fnName;
      } else {
        result += expressions[i];
      }
    }
  });

  // Handle all self-closing tags after the full string is assembled
  result = result.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*)?)\/>/g,
    '<$1$2></$1>'
  );
  
  return document.createRange().createContextualFragment(result);
}

const setupListeners = (component, element) => {
  for (const child of element.children) {
    if (child.tagName && !child.tagName.includes('-')) {
      setupListeners(component, child); 
    }
  }
  
  element.getAttributeNames()
    .filter(key => key.match(/^on\-/))
    .map(key => {
      if (component[element.getAttribute(key)] instanceof Function) {
        element.addEventListener(key.replace('on-', ''), component[element.getAttribute(key)].bind(component), false)        
      }
    });

  const cbAttributes = element.getAttributeNames()
    .filter(key => key.match(/^(cb\-)/));
  
  cbAttributes.forEach(attr => {
    const callbackValue = element.getAttribute(attr);
    const methodName = attributeToCamelCase(attr.replace(/^(cb\-)/, ''));
    const componentMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(component));
    const matchingMethod = componentMethods.find(method => 
      method === callbackValue || 
      component[method].name === callbackValue
    );

    if (matchingMethod) {
      element[methodName] = function(...args) {
        return component[matchingMethod].apply(component, args);
      };
    }
  });
}

const diff = (currentDom, newDom, changes = {added: [], removed: []}) => {
  const currentLength = currentDom.children.length;
  const newLength = newDom.children.length;
  
  if (newLength === 0) {
    changes.removed.concat(Array.from(currentDom.children));
    currentDom.replaceChildren();
    return [currentDom, changes];
  }
  
  if (currentLength === 0 && newLength > 0) {
    changes.removed.concat(Array.from(currentDom.children));
    changes.added.concat(Array.from(newDom.children));
    currentDom.replaceChildren(...Array.from(newDom.children));
    return [currentDom, changes];
  }
  
  if (currentLength > newLength) {
    for (let i = currentLength - 1; i >= newLength; i--) {
      const node = currentDom.children[i];
      changes.removed.push(node.cloneNode(true))
      node.parentNode.removeChild(node);
    }
  } else if (currentLength < newLength) {
    for (let i = currentLength; i < newLength; i++) {
      const node = newDom.children[i].cloneNode(true);
      changes.added.push(node.cloneNode(true));
      currentDom.appendChild(node);
    }
  }
  
  for (let i = 0; i < newLength; i++) {
    const currentNode = currentDom.children[i];
    const newNode = newDom.children[i];
    
    if (currentNode.children.length && newNode.children.length > 0) {
      diff(currentNode, newNode, changes);
    }

    if (currentNode.outerHTML !== newNode.outerHTML) {
      changes.removed.push(currentNode.cloneNode(true));
      changes.added.push(newNode.cloneNode(true));
      currentNode.replaceWith(newNode.cloneNode(true));
    }    
  }

  return [currentDom, changes];
}

const classNameFromTag = tag =>
  tag
    .split('-')
    .map(part => 
      part
        .charAt(0)
        .toUpperCase() + 
      part
        .slice(1)
        .toLowerCase())
    .join('');

const attributeToCamelCase = (attr) => 
  attr.split('-').map((part, index) => 
    index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
  ).join('');

const init = async (el) => {
  if (!el.tagName?.includes('-')) {
    if (el.children) {
      for (const child of el.children) {
        await init(child);
      }
    }
    return;  
  }

  const tag = el.tagName.toLowerCase();
  const href = document.querySelector('link[rel="components"]')?.href;
  const path = el.getAttribute('module');
  const module = await import(href || path);    

  if (!customElements.get(tag)) {
    try {
      customElements.define(tag, href ? module[classNameFromTag(tag)] : module.default);  
      await customElements.whenDefined(tag);
    } catch (e) { console.error(`Could not initialize <${tag}>. Check that the component exist and that is has been imported. (${e.message})`); }
  }
};

const render = element => {
  if (element.componentWillRender.call(element)) {
    const template = element.render.call(element);
    
    // Handle array of templates
    if (Array.isArray(template)) {
      const combinedFragment = document.createDocumentFragment();
      template.forEach(fragment => {
        if (fragment instanceof DocumentFragment) {
          combinedFragment.append(...Array.from(fragment.children));
        }
      });
      
      // Clear existing content
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      // Append new content
      element.append(...Array.from(combinedFragment.children));
    }
    // Handle single template
    else if (template instanceof DocumentFragment) {
      // Clear existing content
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      // Append new content
      element.append(...Array.from(template.children));
    }
    
    if (template) {
      element.componentDidRender.call(element);
    }
  }
}

export default class extends HTMLElement {
  constructor() {
    super();
    this.state = this.getInitialState();

    new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes) {
          Array
            .from(mutation.addedNodes)
            .map(el => {
              return !!init(el) && !!el.getAttributeNames && setupListeners(this, el)
            })
        }
        
        if (mutation.type === 'attributes' && mutation.target.tagName.includes('-') && mutation.attributeName.match(/data-/)) {
          const datasetKey = mutation.attributeName.replace('data-', '');
          mutation.newValue = mutation.target.getAttribute(mutation.attributeName);
          mutation.datasetKey = classNameFromTag(datasetKey);
          mutation.datasetKey = mutation.datasetKey.charAt(0).toLowerCase() + mutation.datasetKey.slice(1);
          mutation.target.didUpdateDataset(mutation);
        }
      });
    }).observe(this, {attributes: true, childList: true, subtree: true, attributeOldValue: true});
    
    render(this);
    init(this);
  }

  connectedCallback() {
    const elementsWithCallbacks = this.querySelectorAll('[*|cb-]');
    elementsWithCallbacks.forEach(element => {
      setupListeners(this, element);
    });
  }
   
  setState(value) {
    const newstate = JSON.stringify(value);
    if (newstate === null) {
      return true;
    }

    const oldstate = JSON.stringify(this.state);
    if (oldstate !== newstate) {
      this.state = Object.assign(this.state, JSON.parse(newstate));
      this.stateDidChange();      
      render(this);
    }
  }
  
  stateDidChange() { }
  getInitialState() { return { } }
  componentWillRender() { return true }
  didUpdateDataset(mutation) { }
  componentDidRender() { }
  render() { }
}

export { init, html, diff };