import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if '<select' not in content:
        return

    # Add import
    if 'CustomSelect' not in content:
        # find the last import
        import_match = list(re.finditer(r'^import .*?;$', content, re.MULTILINE))
        if import_match:
            last_import = import_match[-1]
            insert_pos = last_import.end() + 1
            content = content[:insert_pos] + 'import CustomSelect from "@/component/CustomSelect";\n' + content[insert_pos:]
        else:
            content = 'import CustomSelect from "@/component/CustomSelect";\n' + content

    # Use regex to find <select ...> ... </select> blocks
    select_pattern = re.compile(r'<select(.*?)>(.*?)</select>', re.DOTALL)
    
    def replacer(match):
        attrs_str = match.group(1)
        options_str = match.group(2)
        
        # parse options
        # <option value="All">All</option>
        options = []
        
        # There might be dynamic options: {categories.map(cat => <option ...>)}
        # If it's complex, we'll flag it for manual review
        if '{' in options_str:
            print(f"Skipping dynamic select in {filepath}")
            return match.group(0)
            
        opt_matches = re.finditer(r'<option[^>]*value=["\']([^"\']+)["\'][^>]*>(.*?)</option>', options_str, re.DOTALL)
        for opt_match in opt_matches:
            val = opt_match.group(1)
            lbl = opt_match.group(2).strip()
            options.append(f'{{ value: "{val}", label: "{lbl}" }}')
            
        options_array_str = "[\n" + ",\n".join(options) + "\n]"
        
        # parse attributes
        value_match = re.search(r'value=\{([^}]+)\}', attrs_str)
        value = value_match.group(1) if value_match else '""'
        
        onchange_match = re.search(r'onChange=\{([^}]+)\}', attrs_str)
        onchange = onchange_match.group(1) if onchange_match else ''
        
        # Fix (e) => setVal(e.target.value) to (val) => setVal(val)
        if '(e) =>' in onchange or '(event) =>' in onchange:
            onchange = re.sub(r'\((e|event)\)\s*=>\s*([a-zA-Z0-9_]+)\(\1\.target\.value\)', r'(val) => \2(val)', onchange)
            onchange = re.sub(r'([a-zA-Z0-9_]+)\(e\.target\.value\)', r'\1(val)', onchange) # fallback

        class_match = re.search(r'className=(["\'][^"\']+["\']|{[^}]+})', attrs_str)
        class_name = class_match.group(1) if class_match else ''
        
        disabled_match = re.search(r'disabled={([^}]+)}', attrs_str)
        disabled = disabled_match.group(1) if disabled_match else 'false'
        if 'disabled' in attrs_str and not disabled_match:
            disabled = 'true'

        custom_select = f'<CustomSelect\n'
        if value: custom_select += f'  value={{{value}}}\n'
        if onchange: custom_select += f'  onChange={{{onchange}}}\n'
        custom_select += f'  options={{{options_array_str}}}\n'
        if class_name: custom_select += f'  className={class_name}\n'
        if disabled != 'false': custom_select += f'  disabled={{{disabled}}}\n'
        custom_select += '/>'
        
        return custom_select

    new_content = select_pattern.sub(replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

import glob
for f in glob.glob('buck/src/app/dashboard/**/*.tsx', recursive=True):
    process_file(f)
