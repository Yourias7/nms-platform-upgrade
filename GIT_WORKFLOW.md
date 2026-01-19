# Git Setup & Initial Commit Guide

## First-Time Setup (For the repository owner)

### 1. Initialize Git Repository
```bash
cd "c:\Users\kgafe\Desktop\NMS Upgrade"
git init
```

### 2. Create .env file locally (don't commit it!)
```bash
copy .env.example .env
# Edit .env with your actual credentials
```

### 3. Stage all files
```bash
git add .
```

### 4. Make initial commit
```bash
git commit -m "Initial commit: NMS Platform Upgrade"
```

### 5. Create and push to remote repository

**Option A: GitHub**
1. Go to https://github.com/new
2. Create a new repository (e.g., "nms-platform-upgrade")
3. Don't initialize with README (we already have one)
4. Copy the repository URL

```bash
git remote add origin https://github.com/yourusername/nms-platform-upgrade.git
git branch -M main
git push -u origin main
```

**Option B: GitLab/Bitbucket**
- Similar process, create repository and follow platform-specific instructions

### 6. Create develop branch
```bash
git checkout -b develop
git push -u origin develop
```

## For Collaborators

### 1. Clone the repository
```bash
git clone <repository-url>
cd nms-platform-upgrade
```

### 2. Set up local environment
```bash
# Create virtual environment
python -m venv venv
venv\Scripts\Activate.ps1  # Windows PowerShell

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
copy .env.example .env
# Edit .env with your local database credentials
```

### 3. Start working on a feature
```bash
# Switch to develop branch
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-new-feature

# Make changes, then commit
git add .
git commit -m "Description of changes"

# Push to remote
git push origin feature/my-new-feature
```

### 4. Create Pull Request
- Go to repository on GitHub/GitLab
- Create PR from your feature branch → develop
- Wait for code review and approval

## Quick Reference

### Daily Workflow
```bash
# 1. Start of day - get latest changes
git checkout develop
git pull origin develop

# 2. Create/switch to your feature branch
git checkout -b feature/my-feature
# or
git checkout feature/my-feature

# 3. Make changes and commit frequently
git add .
git commit -m "Clear description of what you changed"

# 4. Push to remote
git push origin feature/my-feature

# 5. Create PR when feature is complete
```

### Common Scenarios

**Sync your branch with latest develop**
```bash
git checkout feature/my-feature
git merge develop
# Resolve conflicts if any
git push origin feature/my-feature
```

**Oops, I'm on the wrong branch**
```bash
# If you haven't committed yet
git stash
git checkout correct-branch
git stash pop
```

**Undo last commit (not pushed yet)**
```bash
git reset --soft HEAD~1
```

**See what changed**
```bash
git status
git diff
```

## Important Reminders

✅ **DO:**
- Commit often with clear messages
- Pull before you start working
- Test your code before committing
- Create feature branches for new work
- Use meaningful branch names
- Review your changes before pushing

❌ **DON'T:**
- Commit `.env` file with passwords
- Commit directly to main branch
- Push broken/untested code
- Use vague commit messages like "update" or "fix"
- Work on multiple features in one branch
- Force push (`git push -f`) to shared branches
