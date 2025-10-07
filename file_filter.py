


import requests
import re
import zipfile
from pathlib import Path
from urllib.parse import urljoin
from typing import List, Dict, Set
from bs4 import BeautifulSoup


class FileFilter:
    def __init__(self, share_url: str):
        self.share_url = share_url
        
        # File extensions 
        self.relevant_extensions = {'.pdf', '.docx', '.doc', '.txt', '.rtf'}
        
        # Keywords that suggest interview files, feedback reports, and usability test reports
        self.target_content_keywords = [
            # Interview files
            'interview', 'befragung', 'gespräch', 'leitfaden', 'filled',
            # Feedback reports
            'feedback', 'evaluation', 'bewertung', 'rückmeldung',
            # Usability test reports
            'usability', 'test', 'testing', 'bericht', 'testbericht',
            'ux-evaluation', 'user', 'survey', 'questionnaire', 'umfrage'
        ]
        
        # Keywords that suggest research papers - to be excluded
        self.research_paper_keywords = [
            'paper', 'chi2020', 'foundations', 'designing', 'maas', 'etal',
            'citizenneeds', 'hubbel', 'display_value', 'interactive_displays',
            'pdf'  # Most research papers are PDFs
        ]
        
        # Other content to exclude
        self.exclude_keywords = [
            'admin', 'config', 'setup', 'install', 'readme',
            'license', 'changelog', 'version', 'backup',
            'doku', 'fahrplan', 'katalog', 'widget'
        ]
    
    def is_relevant_extension(self, filename: str) -> bool:
        
        return Path(filename).suffix.lower() in self.relevant_extensions
    
    def is_usability_test_file(self, filename: str) -> bool:
        
        filename_lower = filename.lower()
        
        # Check for target content keywords 
        has_target_keywords = any(
            keyword in filename_lower for keyword in self.target_content_keywords
        )
        
        # Check for research paper keywords
        has_research_keywords = any(
            keyword in filename_lower for keyword in self.research_paper_keywords
        )
        
        # Check for other exclusion keywords
        has_exclude_keywords = any(
            keyword in filename_lower for keyword in self.exclude_keywords
        )
        
        return has_target_keywords and not has_research_keywords and not has_exclude_keywords
    
    def get_bulk_download_url(self) -> str:
        
        return f"{self.share_url}/download"
    
    def download_all_files(self, download_dir: str = "downloads") -> Path:
        
        download_path = Path(download_dir)
        download_path.mkdir(exist_ok=True)
        
        zip_file = download_path / "bamboards_files.zip"
        
        if zip_file.exists():
            print(f" Archive already exists: {zip_file}")
            return zip_file
        
        print(" Downloading all files as zip archive...")
        
        try:
            download_url = self.get_bulk_download_url()
            response = requests.get(download_url, stream=True)
            response.raise_for_status()
            
            with open(zip_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f" Downloaded: {zip_file} ({zip_file.stat().st_size / 1024 / 1024:.1f} MB)")
            return zip_file
            
        except Exception as e:
            print(f" Error downloading files: {e}")
            return None
    
    def is_excluded_file(self, filename: str) -> bool:
        
        filename_lower = filename.lower()
        
        # Check for exclusion keywords
        return any(keyword in filename_lower for keyword in self.exclude_keywords)
    
    def extract_and_filter_zip(self, zip_file: Path, extract_dir: str = "extracted") -> Dict[str, List[Dict]]:
       
        extract_path = Path(extract_dir)
        extract_path.mkdir(exist_ok=True)
        
        print(f" Extracting files from {zip_file}...")
        print(" Filtering for interview content only (excluding research papers & UX docs)")
        
        categorized = {
            'interview_files': [],
            'excluded_files': [],
            'all_relevant_files': []
        }
        
        try:
            with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                
                print(f" Found {len(file_list)} files in archive")
                
                for file_path in file_list:
                    filename = Path(file_path).name
                    
                    # Skip directories and hidden files
                    if not filename or filename.startswith('.'):
                        continue
                    
                    if self.is_relevant_extension(filename):
                        
                        if self.is_excluded_file(filename):
                            categorized['excluded_files'].append({
                                'name': filename,
                                'reason': 'Research paper/UX documentation'
                            })
                            print(f" Skipping: {filename} ")
                            continue
                        
                        # Only extract usability test files
                        if self.is_usability_test_file(filename):
                            try:
                                zip_ref.extract(file_path, extract_path)
                                extracted_file = extract_path / file_path
                                
                                file_info = {
                                    'name': filename,
                                    'path': extracted_file,
                                    'original_path': file_path,
                                    'is_interview_related': True,
                                    'size': extracted_file.stat().st_size if extracted_file.exists() else 0
                                }
                                
                                categorized['interview_files'].append(file_info)
                                categorized['all_relevant_files'].append(file_info)
                                print(f" Extracted: {filename}")
                                
                            except Exception as e:
                                print(f"  Error extracting {file_path}: {e}")
                        else:
                            print(f"  Skipping: {filename} (not interview-related)")
                
                print(f"Extracted {len(categorized['interview_files'])} interview files")
                print(f" Excluded {len(categorized['excluded_files'])} research/UX files")
                
        except Exception as e:
            print(f" Error processing zip file: {e}")
        
        return categorized
    
    def print_file_summary(self, categorized_files: Dict[str, List[Dict]]):
        
        print("\n File Discovery Summary:")
        print(f" Interview-related files: {len(categorized_files['interview_files'])}")
        print(f" Excluded files: {len(categorized_files.get('excluded_files', []))}")
        print(f" otal relevant files: {len(categorized_files['all_relevant_files'])}")
        
        if categorized_files['interview_files']:
            print("\n Interview-related files:")
            for file_info in categorized_files['interview_files']:
                size_mb = file_info['size'] / 1024 / 1024 if file_info['size'] > 0 else 0
                print(f"   ✓ {file_info['name']} ({size_mb:.1f} MB)")
        
        if categorized_files.get('excluded_files'):
            print("\n Excluded files:")
            for file_info in categorized_files['excluded_files']:
                print(f" {file_info['name']} ({file_info['reason']})")
    
    def manual_file_list(self) -> List[str]:
        
        print("\n Manual file discovery guide:")
        print("   1. Visit the share URL in your browser")
        print("   2. Look for files with these extensions:")
        for ext in sorted(self.relevant_extensions):
            print(f"      - {ext}")
        print("   3. Priority files (interview, feedback, usability test content):")
        for keyword in self.target_content_keywords:
            print(f"      - Files containing '{keyword}'")
        print("   4. Download relevant files to a 'downloads' folder")
        
        return list(self.target_content_keywords)


def main():
    
    SHARE_URL = "https://cloud.smartcitybamberg.de/s/fna28j9bAedqzP2"
    
    filter_tool = FileFilter(SHARE_URL)
    
    print(" Bamboards File Filter - Step 1: Discovery")
    print("=" * 50)
    
    print("\nUsing Bulk Download Approach")
    print("Downloading all files as a zip and filtering locally...")
    
    
    zip_file = filter_tool.download_all_files()
    
    if zip_file:
        print(f"\n Success! Downloaded all files to: {zip_file}")
        
        
        categorized = filter_tool.extract_and_filter_zip(zip_file)
        
       
        filter_tool.print_file_summary(categorized)
        
        print(f"\n Next steps:")
        print("   1. Files are extracted and filtered")
        print("   2. Ready for content extraction")
        print("   3. Ready for wordcloud generation")
        
        return categorized
    else:
        
        filter_tool.manual_file_list()
        return None


if __name__ == "__main__":
    main()