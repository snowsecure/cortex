# Retab Document Extractor

A modern web application for extracting structured data from title insurance documents using the [Retab API](https://retab.com).

## Features

- **PDF Upload**: Drag-and-drop PDF upload with file validation
- **Prebuilt Schemas**: 6 title insurance document schemas ready to use:
  - Title Commitment
  - Deed
  - Mortgage / Deed of Trust
  - Closing Disclosure
  - Title Insurance Policy
  - Survey / Plat
- **Custom Schemas**: Monaco editor for defining custom JSON schemas
- **Auto-Generate**: Automatically generate schemas from uploaded documents
- **Progress Tracking**: Real-time extraction progress with status updates
- **Results Display**: Interactive JSON tree view with confidence scores
- **Export Options**: Copy to clipboard or download as JSON

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Retab API key ([Get one here](https://retab.com/dashboard))

### Installation

```bash
# Install dependencies
npm install

# Start both frontend and proxy server
npm start
```

This starts:
- **Frontend**: http://localhost:5173
- **Proxy Server**: http://localhost:3001 (forwards requests to Retab API)

Alternatively, run servers separately:
```bash
npm run server  # Start proxy server only
npm run dev     # Start frontend only
```

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage

1. **Enter API Key**: On first launch, enter your Retab API key
2. **Upload Document**: Drag and drop a PDF or click to browse
3. **Select Schema**: Choose a prebuilt schema or define a custom one
4. **Extract**: Click "Extract Data" to process the document
5. **View Results**: Browse the extracted data in tree or raw JSON view

## Tech Stack

- **React 18** with Vite
- **Tailwind CSS** for styling
- **Monaco Editor** for JSON schema editing
- **react-dropzone** for file uploads
- **Lucide React** for icons

## Project Structure

```
retab/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── FileUpload.jsx   # PDF upload component
│   │   ├── SchemaSelector.jsx
│   │   ├── ExtractionProgress.jsx
│   │   └── ResultsDisplay.jsx
│   ├── schemas/             # Prebuilt JSON schemas
│   ├── hooks/               # React hooks for API
│   ├── lib/                 # Utilities and API client
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
```

## Security Notes

- API keys are stored in browser localStorage
- For production deployments, consider using a backend proxy to protect API keys
- Not recommended for use on shared or public computers

## License

Internal use only - Stewart Title R&D
