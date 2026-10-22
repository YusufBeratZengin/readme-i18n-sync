# readme-i18n-sync

Çok dilli depo belgeleri için yapısal uyumsuzluk ve sapma tespit aracı.

Çok dilli yazılım depolarında çeviriler zamanla güncelliğini yitirir. Çevirmenler metinleri güncellese bile, kaynak belgelerdeki kod blokları, yapılandırma tabloları, bağlantılar, uyarı kutuları ve sürüm numaraları sık sık değişir. Bu araç, metin yerine belge yapısını karşılaştırarak çevirilerin yapısal ögeleri kaçırdığı veya kaynak git commit'lerinin gerisinde kaldığı durumları raporlar.

## Özellikler

- Yapı odaklı karşılaştırma: başlık hiyerarşisi, kod blokları, bağlantılar, görseller, tablolar, uyarılar ve semver dizgilerini doğrular.
- Otomatik kod bloğu senkronizasyonu: `--fix-code-blocks` parametresi, çevrilmiş metne dokunmadan güncellenen kod parçalarını kaynaktan hedef çeviriye aktarır.
- Sıfır çalışma zamanı bağımlılığı: tamamen Node.js standart kütüphaneleri üzerinde geliştirilmiştir.
- Esnek eşleme: kök dizindeki `README.md` ile `README.<lang>.md` dosyalarını ve `docs/en/**` ile `docs/<lang>/**` dizinlerini doğrudan eşler.
- Git güncellik denetimi: committer zaman damgalarını `git log -1 --format=%ct -- <file>` komutuyla kıyaslar.
- Yoksayma işaretçileri: yerelleştirilmiş eklemeleri HTML yorum etiketleri (`<!-- i18n-sync-ignore -->`) ile denetim dışı bırakır.
- Çoklu çıktı biçimleri: temiz konsol metni, yapılandırılmış JSON ve GitHub Actions iş akışı uyarıları.

## Yapısal Denetimler

| Denetim | Açıklama |
| --- | --- |
| Headings | Toplam başlık sayısını, derinlik sırasını ve hiyerarşik düzeyleri doğrular. |
| Code Blocks | Blok sayısını, dil belirteçlerini ve bayt düzeyinde içerik eşitliğini doğrular. |
| Links | Hedef URL adreslerinin çevrilmiş belgelerde yer aldığını doğrular. |
| Images | Görsel sayısını ve kaynak görsel bağlantılarını doğrular. |
| Tables | Tablo sayısını ve her tablonun sütun yapısını doğrular. |
| Admonitions | GitHub vurgu kutusu türlerini (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`) doğrular. |
| Versions | Kaynak ve çeviri arasındaki semantik sürüm dizgilerinin uyumunu doğrular. |
| Git Staleness | Çeviri commit tarihinin kaynak commit tarihinden eski olmadığını doğrular. |

## Kurulum

```bash
npm install -g readme-i18n-sync
```

Veya doğrudan `npx` kullanarak çalıştırın:

```bash
npx readme-i18n-sync check
```

## Kullanım

### Varsayılan Denetimi Çalıştırma

Depodaki eşleşen belgeleri tarayın ve yapısal uyumu denetleyin:

```bash
i18n-sync check
```

### Eski Kod Bloklarını Otomatik Düzeltme

Kaynak belgedeki kod parçalarını doğrudan çeviri belgelerine aktarın:

```bash
i18n-sync check --fix-code-blocks
```

### Çıktı Biçimleri

Özel araçlar için yapılandırılmış JSON üretin:

```bash
i18n-sync check --format json
```

GitHub Actions iş akışı uyarıları üretin:

```bash
i18n-sync check --format github
```

### Belirli Dosyaları Denetleme

Kaynak ve hedef dosyaları açıkça belirtin:

```bash
i18n-sync check --source README.md --target README.tr.md
```

## Yapılandırma

Depo kök dizininde bir `.i18n-sync.json` dosyası oluşturarak eşleştirme kurallarını ve denetimleri yapılandırabilirsiniz:

```json
{
  "$schema": "https://raw.githubusercontent.com/YusufBeratZengin/readme-i18n-sync/main/schema.json",
  "sourceLanguage": "en",
  "patterns": [
    {
      "source": "README.md",
      "target": "README.:lang.md"
    },
    {
      "source": "docs/en/**/*.{md,markdown}",
      "target": "docs/:lang/**/*.{md,markdown}"
    }
  ],
  "checks": {
    "headings": true,
    "codeBlocks": true,
    "codeBlocksIdentical": true,
    "links": true,
    "images": true,
    "tables": true,
    "admonitions": true,
    "versions": true,
    "gitStaleness": true
  },
  "ignoreLanguages": [],
  "ignoreFiles": []
}
```

## Yoksayma İşaretçileri

Bir çeviri yerel bir içerik barındırdığında (bölgesel sunucu veya yerel topluluk bağlantısı gibi), sapma uyarısı almamak için yorum etiketlerini kullanın:

```markdown
<!-- i18n-sync-ignore -->
### Regional Mirror

<!-- i18n-sync-ignore-start -->
```bash
npm install --registry=https://registry.example.org
```
<!-- i18n-sync-ignore-end -->
```

## GitHub Actions Entegrasyonu

Aşağıdaki iş akışı dosyasını `.github/workflows/docs-sync.yml` konumuna ekleyin:

```yaml
name: Documentation Sync Check

on:
  pull_request:
    paths:
      - 'README*.md'
      - 'docs/**'

jobs:
  verify-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Check documentation drift
        run: npx readme-i18n-sync check --format github
```

## Programatik API

`readme-i18n-sync` paketini Node.js >=20 ortamında kod içinde de kullanabilirsiniz:

```javascript
import { runSyncCheck, parseMarkdown, compareDocuments } from 'readme-i18n-sync';

const { results, allSynced } = await runSyncCheck({
  cwd: process.cwd(),
  fixCodeBlocks: false
});

console.log(`Documentation synchronized: ${allSynced}`);
```

## Lisans

MIT Lisansı. Telif Hakkı (c) 2026 Yusuf Berat Zengin. Ayrıntılar için [LICENSE](https://github.com/YusufBeratZengin/readme-i18n-sync/blob/main/LICENSE) dosyasına bakın.
