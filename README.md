# 🤖 AI Assistant Slack Bot

A channel-aware AI assistant bot for Slack powered by Grok AI that understands context and provides intelligent responses.

## ✨ Features

- **Dynamic Action Triggers**: Create instant-response triggers that bypass AI for common questions
- **Channel Awareness**: Understands channel context, topics, and recent conversations
- **Multi-tenant SaaS**: Can be installed in unlimited Slack workspaces
- **Assistant Pane Integration**: Works seamlessly with Slack's Assistant pane
- **Conversation Summarization**: Provides intelligent channel summaries
- **Direct Messages**: Supports both DMs and channel mentions
- **Data Access API**: Leverages Slack's search capabilities for enhanced context
- **Jira Integration**: Create tickets directly from conversations
- **Template Library**: Pre-built trigger templates for common use cases
- **Configurable Memory**: Adjustable conversation history and context retention

## 🚀 Quick Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**One-click Render deployment:** See [`RENDER_DEPLOY.md`](./RENDER_DEPLOY.md) for detailed instructions.

**Quick deploy script:**
```bash
./deploy-to-render.sh
```

## 🛠️ Installation Options

### Option 1: SaaS Deployment (Recommended)
Perfect for distributing to multiple Slack workspaces.

1. **Deploy to Railway** using the button above
2. **Create Slack App** using `slack-app-manifest.json`
3. **Configure OAuth** with your Railway domain
4. **Set environment variables** in Railway dashboard
5. **Enable public distribution** in Slack

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Option 2: Single Workspace (Socket Mode)
For personal or single-workspace use.

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Start Redis: `redis-server`
5. Run the bot: `npm start`

## 🔧 Environment Variables

### Required
```bash
# Multi-tenant mode (SaaS)
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_STATE_SECRET=your-random-secret

# OR Single tenant mode
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# AI Provider (choose one)
GROK_API_KEY=your-grok-api-key
# OR
XAI_API_KEY=your-xai-api-key
# OR
GEMINI_API_KEY=your-gemini-api-key

# Database
REDIS_URL=redis://localhost:6379
```

### Optional
```bash
# Feature flags
FEAT_CHANNEL_CONTEXT=true
FEAT_RECENT_MESSAGES=true
FEAT_DATA_ACCESS=true
FEAT_RAG=false

# Memory settings
ASSISTANT_THREAD_TTL_SECONDS=86400
ASSISTANT_CONTEXT_TTL_SECONDS=1800
MEMORY_TURNS=16
MEMORY_TTL_DAYS=14
```

## 💬 Usage

### Dynamic Action Triggers ⚡
Create instant responses for common questions that bypass AI processing:

**In App Home:**
- **➕ Add Trigger** - Create custom instant responses
- **📝 Manage Triggers** - Edit, delete, or toggle existing triggers  
- **📋 Import Templates** - Quick-start with pre-built triggers

**Example Triggers:**
```
Input: "office hours", "what time", "when open"
Response: 🕒 Our office hours are Monday-Friday, 9:00 AM to 5:00 PM EST.

Input: "wifi password", "network", "internet"  
Response: 📶 Network: Company-WiFi | Guest: Company-Guest | Contact IT for credentials
```

### In Channels
- **@mention**: `@AI Assistant what's the latest on the project?`
- **With context**: Bot automatically understands channel topic and recent messages
- **Instant triggers**: Common questions get immediate ⚡ responses

### In Direct Messages
- **General chat**: `Hello! How can you help me?`
- **Channel queries**: `tell me about #general`
- **Channel IDs**: `what's happening in #C1234567890`
- **Quick answers**: Triggers work in DMs too

### Assistant Pane
- Open the Assistant pane in any channel
- Ask questions about the current channel context
- Get intelligent summaries and insights

### Slash Commands
- `/ask your question here` - Ask questions with optional channel context
- `/ticket description` - Create Jira tickets from conversations

## 🏗️ Architecture

```
src/
├── config.js                 # Configuration management
├── index.js                  # Application entry point
├── lib/
│   ├── logger.js             # Logging utilities
│   └── slackRetry.js         # Slack API retry logic
├── routes/
│   ├── actions.js            # Interactive component handlers
│   ├── commands.js           # Slash command handlers
│   └── events.js             # Event handlers (mentions, DMs)
├── services/
│   ├── channels.js           # Channel utilities
│   ├── dataAccess.js         # Slack Data Access API
│   ├── inflight.js           # Request deduplication
│   ├── installations.js     # Multi-tenant installation storage
│   ├── intent.js             # Intent detection
│   ├── llm.js               # LLM provider selection
│   ├── llmGemini.js         # Gemini AI integration
│   ├── llmGrok.js           # Grok AI integration
│   ├── memory.js            # Conversation memory (Redis)
│   ├── prompt.js            # System prompt building
│   ├── rag.js               # Retrieval-augmented generation
│   ├── slackdata.js         # Slack data fetching
│   └── store.js             # Message history storage
└── ui/
    └── views.js             # UI components
```

## 🔍 API Endpoints

- `GET /health` - Health check
- `POST /slack/events` - Slack event subscriptions
- `POST /slack/interactive` - Interactive components
- `GET /slack/install` - OAuth installation flow
- `GET /slack/oauth_redirect` - OAuth callback
- `GET /slack/install/success` - Installation success page

## 🧠 AI Providers

The bot supports multiple AI providers with automatic fallback:

1. **Grok (xAI)** - Primary (if `GROK_API_KEY` or `XAI_API_KEY` set)
2. **Gemini** - Fallback (if `GEMINI_API_KEY` set)

## 🗃️ Data Storage

- **Redis**: Conversation history, assistant threads, installation data
- **Automatic cleanup**: Configurable TTLs for all stored data
- **Team isolation**: All data properly namespaced by Slack team ID

## 🚦 Features Configuration

Enable/disable features via environment variables:

- `FEAT_CHANNEL_CONTEXT=true` - Channel metadata and context
- `FEAT_RECENT_MESSAGES=true` - Include recent channel messages
- `FEAT_DATA_ACCESS=true` - Use Slack Data Access API
- `FEAT_RAG=true` - Retrieval-augmented generation

## 🔒 Security

- OAuth 2.0 flow for secure installation
- Proper request signature verification
- Team-isolated data storage
- Automatic token refresh
- No sensitive data in logs

## 📊 Monitoring

- Health check endpoint
- Structured logging
- Installation tracking
- Error handling and reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
- Review logs in Railway dashboard
- Verify Slack app configuration
- Ensure all environment variables are set correctly

## 🔗 Links

- [Slack API Documentation](https://api.slack.com/)
- [Railway Documentation](https://docs.railway.app/)
- [Grok AI (xAI)](https://x.ai/)
- [Slack Bolt Framework](https://slack.dev/bolt-js/)
