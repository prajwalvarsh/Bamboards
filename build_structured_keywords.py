
import json
import os
import re
from pathlib import Path
from typing import Optional



USE_HF = bool(os.getenv('HF_TOKEN'))
USE_LLM = USE_HF




def load_json(p: Path):
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding='utf-8'))


def find_sentence_containing(text: str, keyword: str) -> Optional[str]:
    if not text:
        return None
    # split to sentences roughly (keep newlines as boundaries)
    sentences = re.split(r'(?<=[.!?\n])\s+', text)
    k = keyword.lower()
    # first try exact phrase
    for s in sentences:
        if k in s.lower():
            return s.strip()
    # fallback: split by commas and try parts
    for s in sentences:
        parts = s.split(',')
        for p in parts:
            if any(tok in p.lower() for tok in k.split() if len(tok) > 2):
                return p.strip()
    return None

def llm_generate_prompts(keyword: str, citizen_sentence: str) -> dict:
    if not USE_LLM:
        return {
            'design_suggestion': '[LLM disabled] craft design suggestion here',
            'planning_suggestion': '[LLM disabled] craft planning suggestion here'
     }



    # Hugging Face Inference if HF_TOKEN is set
    if USE_HF:
    try:
        from huggingface_hub import InferenceClient
        hf = InferenceClient(token=os.getenv('HF_TOKEN'))
        model = os.getenv('HF_MODEL')
        # Build prompts that include the exact sentence where the keyword was found
        context = f"Based on this citizen feedback keyword '{keyword}' from the sentence: \"{original_sentence}\""
        
        # Ask for two short plain sentences: first a design suggestion, then a planning suggestion.
        prompt = (
            f"You are an expert urban designer and planner.\n\n"
            f"{context}\n\n"
            "Please provide two short suggestions as plain text: first a design suggestion, then a planning suggestion.\n"
            "Each suggestion should be 1-2 short sentences. Do NOT return JSON—return plain text only, with the design suggestion first, then the planning suggestion on the next line."
        )
        
        text = ''
        try:
            if hasattr(hf, 'chat'):
                try:
                    # Use the ProxyClientChat completions API (create method)
                    chat_resp = hf.chat.completions.create(messages=[{"role": "user", "content": prompt}], model=model, max_tokens=200)
                    # chat_resp may be dict-like with 'choices'
                    if isinstance(chat_resp, dict):
                        
                        if 'choices' in chat_resp and isinstance(chat_resp['choices'], list) and chat_resp['choices']:
                            choice = chat_resp['choices'][0]
                            # Hf sometimes nests under 'message' -> 'content'
                            if isinstance(choice, dict):
                                msg = choice.get('message') or {}
                                if isinstance(msg, dict):
                                    text = msg.get('content') or msg.get('text') or ''
                                else:
                                    text = str(choice)
                            else:
                                text = str(choice)
                except Exception as e:
                    print('hf.chat.completions call failed:', e)
                    text = ''

        # If we have text, parse first two sentences as design and planning suggestions
        if text:
            lines = [l.strip() for l in re.split(r"[\n\r]+", text) if l.strip()]
            joined = ' '.join(lines)
            sents = re.split(r'(?<=[.!?])\s+', joined)
            design = sents[0].strip() if sents else ''
            planner = sents[1].strip() if len(sents) > 1 else ''
            if not design:
                design = f"[HF empty] design suggestion for '{keyword}'"
            if not planner:
                planner = f"[HF empty] planning suggestion for '{keyword}'"
            return {'design_suggestion': design, 'planning_suggestion': planner}

        # If no usable text returned, return placeholders
        return {
            'design_suggestion': f"[HF unavailable] design suggestion for '{keyword}'",
            'planning_suggestion': f"[HF unavailable] planning suggestion for '{keyword}'"
        }
    except Exception as e:
        print(' HuggingFace inference failed:', e)



def main():
    kb_path = Path('keybert_keywords.json')
    if not kb_path.exists():
        print('keybert_keywords.json not found. Run extract_keywords_keybert.py first.')
        return

    kb = load_json(kb_path)
    extractor = ContentExtractor() if ContentExtractor else None

    results = []
    files_processed = 0

    for fileEntry in kb.get('results', []):
        # Prefer the full filepath recorded by the KeyBERT run. If absent, fall back to filename.
        recorded_filepath = fileEntry.get('filepath')
        recorded_name = fileEntry.get('filename')
        text = ''

        # Try recorded full filepath first
        if recorded_filepath:
            candidate = Path(recorded_filepath)
            if candidate.exists():
                try:
                    if extractor:
                        text = extractor.extract_text(candidate)
                    else:
                        text = candidate.read_text(encoding='utf-8', errors='ignore')
                except Exception:
                    text = ''


        # Process keywords for this file
        for kw in fileEntry.get('keywords', []):
            phrase = (kw.get('keyword') or '').strip()
            if not phrase:
                continue
            sentence = find_sentence_containing(text, phrase) or ''
            # If no sentence found in extracted text, fall back to KeyBERT's example sentences
            if not sentence:
                ex_sents = fileEntry.get('example_sentences') or []
                first = next((s for s in ex_sents if s and s.strip()), None)
                if first:
                    sentence = first.strip()

            suggestions = llm_generate_prompts(phrase, sentence)
            # Ensure non-empty suggestions: replace empty strings with placeholders
            design_sugg = suggestions.get('design_suggestion', '') or f"[HF empty] design suggestion for '{phrase}'"
            plan_sugg = suggestions.get('planning_suggestion', '') or f"[HF empty] planning suggestion for '{phrase}'"
            entry = {
                'day': '',
                'keyword': phrase,
                'roles': {
                    # include the exact sentence where the keyword was picked up
                    'citizen': {
                        'original_sentence': sentence,
                        'exact_sentence': sentence
                    },
                    'designer': {'design_suggestion': design_sugg},
                    'planner': {'planning_suggestion': plan_sugg}
                },
                'source': str(recorded_filepath or recorded_name or 'unknown')
            }
            results.append(entry)

    out = Path('structured_keywords.json')
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Processed {files_processed} files and wrote {len(results)} keyword entries to {out}")

if __name__ == '__main__':
    main()
