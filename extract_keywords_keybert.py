#!/usr/bin/env python3
"""
Batch keyword extraction using KeyBERT

Scans files under `extracted/`, extracts text with `ContentExtractor`,
uses KeyBERT (with sentence-transformers embeddings) to extract keywords
and saves results to `keybert_keywords.json`.
"""
from pathlib import Path
import json
from typing import List, Dict

from content_extractor import ContentExtractor

def extract_keywords_for_text(text: str, top_n: int = 15) -> List[Dict]:
    try:
        from keybert import KeyBERT
        from sentence_transformers import SentenceTransformer
    except Exception as e:
        print("  KeyBERT or sentence-transformers not installed or failed to import:", e)
        return []

    if not text:
        return []

    # Use a compact embedding model that's common and fast
    
    model = SentenceTransformer('all-MiniLM-L6-v2')
   

    try:
        kw_model = KeyBERT(model=model)
        keywords = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 2),
            stop_words=None,
            use_mmr=True,
            diversity=0.6,
            top_n=top_n
        )
        # keywords is list of (phrase, score)
        return [{'keyword': k, 'score': float(s)} for k, s in keywords]
    except Exception as e:
        print("KeyBERT extraction failed:", e)
        return []


def process_extracted_folder(root: Path, output_file: Path):
    extractor = ContentExtractor()
    results = []

    files = list(root.rglob('*'))
    # filter to files with supported extensions
    supported = {'.pdf', '.docx', '.doc', '.txt', '.rtf'}
    files = [f for f in files if f.is_file() and f.suffix.lower() in supported]

    # define heuristics to detect research papers/journals to skip
    research_keywords = {
        'paper', 'papers', 'proceedings', 'conference', 'journal', 'journal-',
        'etal', 'doi', 'study', 'studies', 'research', 'maas_', 'chi', 'proceeding',
        'citizenneeds', 'foundations', 'display_value', 'paper_chi'
    }

    def is_research_paper(p: Path) -> bool:
        # Only flag PDFs that are likely research papers (by filename)
        if p.suffix.lower() != '.pdf':
            return False
        name = p.name.lower()
        full = str(p).lower()
        for kw in research_keywords:
            if kw in name or kw in full:
                return True
        return False

    # exclude research papers/journals
    pre_count = len(files)
    files = [f for f in files if not is_research_paper(f)]
    skipped = pre_count - len(files)
    if skipped:
        print(f" Skipped {skipped} files identified as research papers/journals")

    print(f" Found {len(files)} supported files under: {root}")

    for fp in files:
        # Show a stable filepath string — avoid Path.relative_to which can raise if
        # one path is relative and the other absolute in some environments
        print(f"\n📄 Processing: {fp}")
        text = extractor.extract_text(fp)
        if not text:
            print("   ⚠️  No text extracted, skipping")
            continue

        cleaned = extractor.clean_text(text)
        keywords = extract_keywords_for_text(cleaned, top_n=20)

        # also capture a few example sentences containing top keywords
        top_terms = [k['keyword'] for k in keywords[:8]]
        sentences = extractor.extract_sentences_with_keywords(text, top_terms)

        results.append({
            'filename': fp.name,
            'filepath': str(fp),
            'keywords': keywords,
            'example_sentences': sentences[:6]
        })

    # save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({'summary': {'files_processed': len(results)}, 'results': results}, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Saved KeyBERT keywords to: {output_file}")


def main():
    extracted_dir = Path('extracted')
    if not extracted_dir.exists():
        print(f"❌ Extracted folder not found: {extracted_dir.resolve()}")
        return

    out = Path('keybert_keywords.json')
    process_extracted_folder(extracted_dir, out)


if __name__ == '__main__':
    main()
