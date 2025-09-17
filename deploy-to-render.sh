#!/bin/bash

echo "🚀 Deploying Slack Groq Bot to Render..."
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if git is clean
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes. Committing them now...${NC}"
    git add .
    read -p "Enter commit message: " commit_msg
    git commit -m "$commit_msg"
fi

# Push to GitHub
echo -e "${GREEN}📤 Pushing to GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully pushed to GitHub!${NC}"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Code pushed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. 🔗 Go to Render Dashboard: https://dashboard.render.com"
echo "2. 🆕 Create a new Web Service connected to your GitHub repo"
echo "3. ⚙️  Configure environment variables (see RENDER_DEPLOY.md)"
echo "4. 🔄 Update your Slack app manifest with Render URLs"
echo "5. 🧪 Test your deployment!"
echo ""
echo "📖 Full deployment guide: ./RENDER_DEPLOY.md"
echo ""
echo -e "${YELLOW}🔑 Don't forget to set up these required environment variables:${NC}"
echo "   - SLACK_CLIENT_ID"
echo "   - SLACK_CLIENT_SECRET"
echo "   - SLACK_SIGNING_SECRET"
echo "   - GROK_API_KEY (or XAI_API_KEY or GEMINI_API_KEY)"
echo "   - REDIS_URL"
echo ""
echo -e "${GREEN}✨ Your bot now includes Dynamic Action Triggers!${NC}"
echo "   Users can create instant responses for common questions."
