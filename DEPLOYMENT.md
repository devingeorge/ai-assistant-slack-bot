# Multi-Tenant Slack Bot Deployment Guide

This guide explains how to deploy your AI Assistant bot as a multi-tenant SaaS application that can be installed in any Slack workspace.

## 🚀 Railway Deployment

### 1. Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

Or manually:
1. Fork this repository
2. Connect your GitHub repo to Railway
3. Railway will auto-detect the `railway.toml` configuration

### 2. Add Redis Database

1. In Railway dashboard, click **"+ New"**
2. Select **"Database" → "Redis"**
3. Railway will automatically set `REDIS_URL` environment variable

### 3. Set Environment Variables

In Railway dashboard, go to your app → **Variables** and set:

```bash
# Required: Slack App Credentials
SLACK_CLIENT_ID=123456789.123456789
SLACK_CLIENT_SECRET=your-client-secret-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_STATE_SECRET=a-random-secret-string-here

# Required: AI Provider (choose one)
GROK_API_KEY=your-grok-api-key
# OR
XAI_API_KEY=your-xai-api-key  
# OR
GEMINI_API_KEY=your-gemini-api-key

# Optional: Feature Configuration
FEAT_CHANNEL_CONTEXT=true
FEAT_RECENT_MESSAGES=true
FEAT_DATA_ACCESS=true
FEAT_RAG=false

# Optional: Memory Settings
ASSISTANT_THREAD_TTL_SECONDS=86400
ASSISTANT_CONTEXT_TTL_SECONDS=1800
MEMORY_TURNS=16
MEMORY_TTL_DAYS=14
```

## 📱 Slack App Configuration

### 1. Create the Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From an app manifest"**
4. Select your development workspace
5. Use the manifest from `slack-app-manifest.json` (update URLs with your Railway domain)

### 2. Update Manifest URLs

Replace `your-domain.railway.app` with your actual Railway domain in:
- `oauth_config.redirect_urls`
- `settings.event_subscriptions.request_url`
- `settings.interactivity.request_url`

### 3. Configure OAuth & Permissions

1. Go to **"OAuth & Permissions"**
2. Add your Railway URL to **Redirect URLs**:
   ```
   https://your-domain.railway.app/slack/oauth_redirect
   ```
3. Bot scopes should already be configured from the manifest

### 4. Enable Event Subscriptions

1. Go to **"Event Subscriptions"**
2. Set Request URL: `https://your-domain.railway.app/slack/events`
3. Subscribe to bot events (already configured in manifest)

### 5. Enable Interactivity

1. Go to **"Interactivity & Shortcuts"**
2. Set Request URL: `https://your-domain.railway.app/slack/interactive`

### 6. Distribute Your App

1. Go to **"Manage Distribution"**
2. Complete the checklist
3. **Remove hard-coded information** (should already be done)
4. **Activate public distribution**

## 🔗 Installation URLs

Once deployed and configured:

- **Direct Install**: `https://your-domain.railway.app/slack/install`
- **Add to Slack Button**:
  ```html
  <a href="https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=app_mentions:read,channels:history,channels:join,channels:read,chat:write,chat:write.public,commands,groups:history,groups:read,im:history,im:read,im:write,mpim:history,mpim:read,search:read,users:read,assistant:write">
    <img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
  </a>
  ```

## 🔍 Health Checks

- **Health endpoint**: `https://your-domain.railway.app/health`
- **Installation success**: `https://your-domain.railway.app/slack/install/success`

## 🗂️ Data Storage

All installation data and conversation history is stored in Redis with automatic expiration:

- **Installations**: 1 year TTL
- **Conversation history**: Configurable via `MEMORY_TTL_DAYS`
- **Assistant threads**: Configurable via `ASSISTANT_THREAD_TTL_SECONDS`
- **Assistant context**: Configurable via `ASSISTANT_CONTEXT_TTL_SECONDS`

## 📊 Monitoring Installations

Check Railway logs to see installation events:
```
[info] Saved installation: {"teamId":"T1234567","enterpriseId":null}
```

## 🛠️ Troubleshooting

### Common Issues:

1. **"Installation not found"**: Check Redis connectivity and environment variables
2. **"Invalid signature"**: Verify `SLACK_SIGNING_SECRET` is correct
3. **"Missing scope"**: Ensure all required scopes are configured in Slack app
4. **"Request URL failed"**: Check that Railway deployment is running and accessible

### Debug Endpoints:

- Health check: `GET /health`
- View logs in Railway dashboard
- Check Redis keys: Use Railway Redis console

## 🔒 Security Notes

- Never commit secrets to version control
- Use Railway's environment variables for all sensitive data
- The `SLACK_STATE_SECRET` should be a random, secure string
- Consider enabling IP allowlisting in Railway for additional security

## 📈 Scaling

Railway auto-scales based on usage. For high-traffic scenarios:

1. **Upgrade Redis**: Use Railway Pro Redis for better performance
2. **Monitor memory**: Track Redis memory usage in Railway dashboard
3. **Rate limiting**: Consider implementing rate limiting for API calls
4. **Horizontal scaling**: Railway supports horizontal scaling for stateless apps
