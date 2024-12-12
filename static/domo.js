const html = (strings, ...expressions) => {
  let result = '';
  
  strings.forEach((string, i) => {
    result += string;
    
    if (i < expressions.length) {
      if (expressions[i] instanceof Function) {
        const fnName = expressions[i].name || `callback_${Math.random().toString(36).substr(2, 9)}`;
        result += fnName;
      } else {
        result += expressions[i];
      }
    }
  });

  result = result.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*)?)\/>/g,
    '<$1$2></$1>'
  );
  
  const fragment = document.createRange().createContextualFragment(result);
  
  // Preserve component instance reference on elements
  Array.from(fragment.children).forEach(child => {
    if (child.tagName?.includes('-')) {
      child._parentComponentInstance = this;
    }
  });
  
  return fragment;
}

const setupListeners = (component, element) => {
  // Set up listeners for the current element
  element.getAttributeNames()
    .filter(key => key.match(/^on\-/))
    .forEach(key => {
      if (component[element.getAttribute(key)] instanceof Function) {
        element.addEventListener(
          key.replace('on-', ''), 
          component[element.getAttribute(key)].bind(component), 
          false
        );
      }
    });

  // Handle callbacks
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

  // Recursively set up listeners for all children
  Array.from(element.children).forEach(child => {
    if (child.tagName && !child.tagName.includes('-')) {
      setupListeners(component, child);
    }
  });
}

const diff = (currentDom, newDom, changes = {added: [], removed: []}) => {
  const currentLength = currentDom.children.length;
  const newLength = newDom.children.length;
  
  if (newLength === 0) {
    changes.removed = changes.removed.concat(Array.from(currentDom.children));
    currentDom.replaceChildren();
    return [currentDom, changes];
  }
  
  if (currentLength === 0 && newLength > 0) {
    const newChildren = Array.from(newDom.children);
    changes.removed = changes.removed.concat(Array.from(currentDom.children));
    changes.added = changes.added.concat(newChildren);
    currentDom.replaceChildren(...newChildren);
    return [currentDom, changes];
  }
  
  if (currentLength > newLength) {
    for (let i = currentLength - 1; i >= newLength; i--) {
      const node = currentDom.children[i];
      changes.removed.push(node.cloneNode(true));
      node.parentNode.removeChild(node);
    }
  } else if (currentLength < newLength) {
    for (let i = currentLength; i < newLength; i++) {
      const node = newDom.children[i].cloneNode(true);
      changes.added.push(node);
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
      const newNodeClone = newNode.cloneNode(true);
      changes.removed.push(currentNode.cloneNode(true));
      changes.added.push(newNodeClone);
      currentNode.replaceWith(newNodeClone);
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
    
    // Create a temporary container for the new content
    const tempContainer = document.createElement('div');
    
    // Handle array of templates
    if (Array.isArray(template)) {
      const combinedFragment = document.createDocumentFragment();
      template.forEach(fragment => {
        if (fragment instanceof DocumentFragment) {
          combinedFragment.append(...Array.from(fragment.children));
        }
      });
      tempContainer.append(...Array.from(combinedFragment.children));
    }
    // Handle single template
    else if (template instanceof DocumentFragment) {
      tempContainer.append(...Array.from(template.children));
    }

    // Perform the diff and get the updated DOM
    const [updatedDom, changes] = diff(element, tempContainer);

    // Set up listeners for all new elements
    changes.added.forEach(node => {
      setupListeners(element, node);
    });

    if (template) {
      element.componentDidRender.call(element);
    }
  }
}

export default class Domo extends HTMLElement {
  constructor() {
    super();
    this.state = this.getInitialState();
    this._renderPending = true;

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
    
    init(this);
  }

  // Add this new lifecycle method
  attributeChangedCallback(name, oldValue, newValue) {
    if (this._renderPending) {
      this._setupCallbacks();
    }
  }

  connectedCallback() {
    this._setupCallbacks();
    if (this._renderPending) {
      this._renderPending = false;
      render(this);
    }
  }

  _setupCallbacks() {
    // Find the parent component instance
    let parent = this.parentElement;
    while (parent && !parent.tagName?.includes('-')) {
      parent = parent.parentElement;
    }

    if (parent) {
      // Get all cb- attributes
      const cbAttributes = this.getAttributeNames()
        .filter(key => key.match(/^(cb\-)/));
      
      cbAttributes.forEach(attr => {
        const callbackValue = this.getAttribute(attr);
        const methodName = attributeToCamelCase(attr.replace(/^(cb\-)/, ''));
        
        // Look for the method on the parent
        if (parent[callbackValue] instanceof Function) {
          this[methodName] = (...args) => parent[callbackValue].apply(parent, args);
        } else {
          // Look through parent's prototype methods
          const parentMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(parent));
          const matchingMethod = parentMethods.find(method => 
            method === callbackValue || 
            parent[method]?.name === callbackValue
          );

          if (matchingMethod) {
            this[methodName] = (...args) => parent[matchingMethod].apply(parent, args);
          }
        }
      });
    }
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
      this._renderPending = true;
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