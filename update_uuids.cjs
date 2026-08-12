const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace user.company with user.companyId in queries
    content = content.replace(/\.eq\("company",\s*user\.company\)/g, '.eq("company_id", user.companyId)');
    content = content.replace(/\.eq\("name",\s*user\.company\)/g, '.eq("id", user.companyId)');
    content = content.replace(/\.eq\("company_id",\s*user\.company\)/g, '.eq("company_id", user.companyId)');

    // For cases where we construct objects: { company: user.company } -> { company_id: user.companyId }
    content = content.replace(/company:\s*user\.company,/g, 'company_id: user.companyId,');

    // Replace function calls:
    content = content.replace(/getSubscriptionInfo\(user\.company\)/g, 'getSubscriptionInfo(user.companyId)');
    content = content.replace(/startCheckout\(user\.company,/g, 'startCheckout(user.companyId,');
    content = content.replace(/openPortal\(user\.company\)/g, 'openPortal(user.companyId)');
    content = content.replace(/getActiveMenuImages\(user\.company\)/g, 'getActiveMenuImages(user.companyId)');
    content = content.replace(/generateMenuImages\(user\.company\)/g, 'generateMenuImages(user.companyId)');
    content = content.replace(/triggerRegeneration\(user\.company\)/g, 'triggerRegeneration(user.companyId)');

    // In Dashboard.tsx: <Dashboard company={user.company} ... /> -> <Dashboard company={user.companyId} ... />
    // Actually Dashboard component might still expect 'company' prop. Let's look at it if it fails.

    // In WhatsApp.tsx fetch
    content = content.replace(/\?company_id=\$\{encodeURIComponent\(user\.company\)\}/g, '?company_id=${encodeURIComponent(user.companyId)}');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
