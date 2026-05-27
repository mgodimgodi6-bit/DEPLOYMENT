# BRIIZ AI — Advanced Business Intelligence Platform
### Created by Bongumusa Madulini

A production-grade AI advisor for finance, labour law, SARS tax, entrepreneurship, and business strategy — with document upload, RAG memory, and voice capabilities.

---

## STEP-BY-STEP SETUP GUIDE

---

### STEP 1 — Install Node.js

Download and install Node.js v18 or higher from:
https://nodejs.org/

Verify installation:
```bash
node --version   # should show v18+
npm --version
```

---

### STEP 2 — Get Your API Keys

You need 2 API keys:

#### A. OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy and save it — you won't see it again
4. Add billing at https://platform.openai.com/settings/billing

#### B. Pinecone API Key
1. Go to https://app.pinecone.io/ and create a free account
2. Click "API Keys" in the left sidebar
3. Copy your API key
4. Create a new Index:
   - Name: `briiz-ai-db`
   - Dimensions: `3072`
   - Metric: `cosine`
   - Cloud: AWS, Region: us-east-1 (or closest to you)

---

### STEP 3 — Set Up the Project

```bash
# Navigate to the project folder
cd briiz-ai

# Install all dependencies
npm install
```

---

### STEP 4 — Configure Environment Variables

Create a file called `.env.local` in the project root:

```bash
# On Mac/Linux:
cp .env.example .env.local

# On Windows — create the file manually
```

Open `.env.local` and fill in your keys:

```
OPENAI_API_KEY=sk-...your-actual-key...
PINECONE_API_KEY=...your-actual-key...
PINECONE_INDEX_NAME=briiz-ai-db
```

---

### STEP 5 — Run the App

```bash
npm run dev
```

Open your browser at: **http://localhost:3000**

---

### STEP 6 — Test the App

1. **Basic chat** — Type a question and press Enter
2. **Upload a document** — Click "Documents" in the sidebar → drag a PDF or Excel file
3. **Deep analysis** — After upload, click the "◎ Deep Analyze" button
4. **Switch modes** — Use the mode buttons in the header

---

### STEP 7 — Deploy to Production (Vercel — FREE)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow the prompts, then add your environment variables in:
# https://vercel.com/your-project/settings/environment-variables
```

---

## HOW EACH FEATURE WORKS

### Document Upload (RAG System)
1. User uploads PDF/Excel/image
2. App extracts all text
3. Text is split into chunks of ~800 characters
4. Each chunk is converted to a 3072-dimensional vector using OpenAI embeddings
5. Vectors are stored in Pinecone
6. When user asks a question, the query is also vectorised
7. Top 8 most relevant chunks are retrieved from Pinecone
8. Retrieved context is injected into the AI prompt

### Analysis Modes
| Mode | Expertise |
|------|-----------|
| General | Broad AI assistant |
| Financial | P&L, cash flow, ratios, predictions |
| Labour Law | BCEA, LRA, EEA, CCMA, contracts |
| Entrepreneur | Musk/Gates/Bezos/Jobs strategies |
| Coach | SWOT, business models, client acquisition |
| SARS Tax | VAT, PAYE, Income Tax, deductions |
| Blueprint | Full business plans and roadmaps |

### Voice Agent (VAPI)
1. Go to https://dashboard.vapi.ai/
2. Create a new assistant
3. Import the `briiz-vapi-agent.json` configuration
4. Set your OpenAI key in the VAPI dashboard
5. Test via the VAPI phone number or embed the widget

---

## PROJECT STRUCTURE

```
briiz-ai/
├── app/
│   ├── page.tsx              # Main chat UI
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Design system
│   └── api/
│       ├── chat/route.ts     # Chat endpoint (RAG + AI)
│       ├── upload/route.ts   # Document upload endpoint
│       └── analyze/route.ts  # Deep analysis endpoint
├── lib/
│   ├── openai.ts             # AI response generation + modes
│   ├── vectorDB.ts           # Pinecone operations
│   ├── embeddings.ts         # OpenAI text embeddings
│   └── documents.ts          # PDF/Excel/image parsing
├── briiz-vapi-agent.json     # Voice agent configuration
├── .env.example              # API key template
└── README.md                 # This file
```

---

## TROUBLESHOOTING

### "OPENAI_API_KEY is missing"
→ Make sure your `.env.local` file exists and has the correct key

### "Pinecone index not found"
→ Create an index named `briiz-ai-db` with 3072 dimensions in Pinecone

### "Document failed to parse"
→ Ensure the PDF is not password-protected or image-only (scanned PDFs use OCR automatically)

### App runs but AI gives generic responses
→ Your API keys are working. Upload a document to enable RAG-powered responses.

---

## COSTS (ESTIMATE)

| Service | Free Tier | Paid |
|---------|-----------|------|
| OpenAI | None (pay per use) | ~$0.01-0.05 per chat |
| Pinecone | Free (1 index, 100k vectors) | $70/month for more |
| Vercel | Free (hobby) | $20/month pro |

For a small business, expect ~$5-20/month in OpenAI costs.

---

## SUPPORT

Built by **Bongumusa Madulini**  
For questions, customisations, or enterprise deployments, contact the developer.
