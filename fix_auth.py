#!/usr/bin/env python3
import re

with open('C:\\Users\\godav\\Downloads\\E-blood_backend\\dist\\routes\\auth.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the INSERT statement
old_pattern = r'''const finalUsername = isPhone \\? `\`user_\${identifier\.slice\(-4\)}\` : identifier\.split\("@"\)\[0\]\`;
            await conn\.execute\(\`INSERT INTO users \(username, email, phone, password_hash, role, blood_group\)\)
         VALUES \(\:username, :email, :phone, :password_hash, :role, :blood_group\)\`, \{
                username: finalUsername,
                email: isPhone ? null : identifier,
                phone: isPhone ? identifier : null,
                password_hash: passwordHash,
                role: role,
                blood_group: result\.data\.bloodGroup \?\? null,
            }, \{ autoCommit: false \});'''

new_pattern = r'''const finalUsername = isPhone ? `\`user_\${identifier\.slice\(-4\)}\` : identifier\.split\("@"\)\[0\]\`;
            // Use sequence to generate user_id since column is NOT NULL without IDENTITY property
            const userIdResult = await conn\.execute\("SELECT SEQ_USERS\.NEXTVAL FROM DUAL"\), [], \{ autoCommit: true \};
            const userId = userIdResult\.rows\[0\]\[0\];
            await conn\.execute\(\`INSERT INTO users \(user_id, username, email, phone, password_hash, role, blood_group\)\)
         VALUES \(\:user_id, :username, :email, :phone, :password_hash, :role, :blood_group\)\`, \{
                user_id: userId,
                username: finalUsername,
                email: isPhone ? null : identifier,
                phone: isPhone ? identifier : null,
                password_hash: passwordHash,
                role: role,
                blood_group: result\.data\.bloodGroup \?\? null,
            }, \{ autoCommit: false \});'''

# Try a simpler approach - just replace the specific lines
if "const finalUsername = isPhone" in content:
    # Simpler replacement - just replace the INSERT block
    lines = content.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if "const finalUsername = isPhone" in line and i + 1 < len(lines) and "await conn.execute" in lines[i+1]:
            # This is the start of the block we want to replace
            new_lines.append('            const finalUsername = isPhone ? `\`user_\${identifier.slice(-4)}\` : identifier.split("@")[0];')
            new_lines.append('            // Use sequence to generate user_id since column is NOT NULL without IDENTITY property')
            new_lines.append('            const userIdResult = await conn.execute("SELECT SEQ_USERS.NEXTVAL FROM DUAL", [], { autoCommit: true });')
            new_lines.append('            const userId = userIdResult.rows[0][0];')
            new_lines.append('            await conn.execute(`INSERT INTO users (user_id, username, email, phone, password_hash, role, blood_group)`)
')
            new_lines.append('         VALUES (:user_id, :username, :email, :phone, :password_hash, :role, :blood_group)`, {')
            new_lines.append('                user_id: userId,')
            new_lines.append('                username: finalUsername,')
            new_lines.append('                email: isPhone ? null : identifier,')
            new_lines.append('                phone: isPhone ? identifier : null,')
            new_lines.append('                password_hash: passwordHash,')
            new_lines.append('                role: role,')
            new_lines.append('                blood_group: result.data.bloodGroup ?? null,')
            new_lines.append('            }, { autoCommit: false });')
            # Skip the old 3 lines (finalUsername, await conn.execute, and the start of the object)
            i += 1  # skip the "await conn.execute" line
            # Now skip the object lines until we hit the autoCommit line
            while i < len(lines) and "autoCommit: false" not in lines[i]:
                i += 1
            # i is now at "autoCommit: false" line, don't skip it
        else:
            new_lines.append(line)
        i += 1
    
    content = '\n'.join(new_lines)
    with open('C:\\Users\\godav\\Downloads\\E-blood_backend\\dist\\routes\\auth.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replacement successful')
else:
    print('Pattern not found, trying different approach...')
    # Just print the relevant lines for debugging
    lines = content.split('\n')
    for i in range(193, min(210, len(lines))):
        print(f'{i+1}: {repr(lines[i])}')