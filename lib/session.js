class Session {
  /**
   * @param {Page} page
   * @param {!Puppeteer.CDPSession} cdpSession
   */
  constructor (page, cdpSession) {
    this._page = page
    this._cdpSession = cdpSession

    this.protocol = this._wrapProtocol()
  }

  detach () {
    return this._cdpSession.detach()
  }

  send (method, params) {
    return this._cdpSession.send(method, params)
  }

  _wrapProtocol () {
    return new Proxy({}, {
      get: (target, agentName, receiver) => new Proxy({}, {
        get: (target, methodName, receiver) => {
          const eventPattern = /^(on(ce)?|off)([A-Z][A-Za-z0-9]*)/
          const match = eventPattern.exec(methodName)
          if (!match) {
            return args => this.send(`${agentName}.${methodName}`, args || {})
          }
          let eventName = match[3]
          eventName = eventName.charAt(0).toLowerCase() + eventName.slice(1)
          if (match[1] === 'once') {
            return eventMatcher => this._waitForEvent(`${agentName}.${eventName}`, eventMatcher)
          }
          if (match[1] === 'off') {
            return handler => this._removeEventHandler(`${agentName}.${eventName}`, handler)
          }
          return handler => this._addEventHandler(`${agentName}.${eventName}`, handler)
        }
      })
    })
  }

  _addEventHandler (eventName, handler) {
    return this._cdpSession.on(eventName, handler)
  }

  _removeEventHandler (eventName, handler) {
    return this._cdpSession.off(eventName, handler)
  }

  _waitForEvent (eventName, eventMatcher) {
    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (eventMatcher && !eventMatcher(result)) {
          return
        }
        this._removeEventHandler(eventName, handler)
        resolve(result)
      }
      this._addEventHandler(eventName, handler)
    })
  }
}

module.exports = {
  Session: Session
}
