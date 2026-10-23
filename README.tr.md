# readme-i18n-sync
[![CI](https://github.com/YusufBeratZengin/readme-i18n-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/readme-i18n-sync/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/readme-i18n-sync)](https://www.npmjs.com/package/readme-i18n-sync) [![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org) [![Dependencies](https://img.shields.io/badge/runtime_dependencies-0-green)](package.json)
<!-- i18n-sync-ignore -->
[English](README.md) | Türkçe

Kaynak Markdown belgesi ile çevirileri arasındaki yapı farklarını bulur.
Ek çalışma zamanı bağımlılığı yoktur. Belge yapısını ve git geçmişini yerel olarak inceler.
Kurulum: `npm install -g readme-i18n-sync` (Node.js 20+).
Çalıştırma: `i18n-sync check`.

## Örnek çıktı

Bu çıktı, `test/fixtures/basic/` içinde `node ../../../bin/i18n-sync.js check` çalıştırılarak alındı (çıkış kodu 1). İspanyolca test belgesinde bilerek bırakılmış farklar var. Türkçe belge kaynakla uyumlu. Çıktının her çalıştırmada aynı olması için bu örnekte git kontrolü kapalı.

<!-- basic-output -->
~~~text
[DRIFT] README.es.md (source: README.md, lang: es)
  - line 20: [headings] Heading #4 level mismatch: source has H3 ("Configuration"), target has H2 ("Configuración")
  - line 7: [codeBlocks] Code block #1 content differs from source
  - line 15: [codeBlocks] Code block #2 content differs from source
  - [links] Missing link target in translation: "https://example.com/project" (source line 30)
  - [images] Missing image source in translation: "https://example.com/logo.png" (source line 30)
  - line 22: [tables] Table #1 column count mismatch: source has 3 columns, target has 2
  - line 26: [admonitions] Admonition #1 type mismatch: source has [!NOTE], target has [!WARNING]
  - [versions] Version mismatch: source version "0.1.0" not found in translation (source line 30)
  - line 29: [versions] Outdated or extra version: translation mentions version "0.0.9", not found in source
[OK] README.tr.md (source: README.md, lang: tr)

Summary:
  Pairs checked: 2 (1 synced, 1 with drift)
  Issues: 9 warnings, 0 errors
~~~
<!-- /basic-output -->

## Kurulum

Yukarıdaki kurulum komutunu kullanabilirsiniz. Repoyu indirdiyseniz `node bin/i18n-sync.js check` ile doğrudan çalıştırabilirsiniz. Derleme gerekmez.

## Kullanım

~~~bash
i18n-sync check
i18n-sync check --format json
i18n-sync check --format github
i18n-sync check README.tr.md
i18n-sync check --source README.md --target README.tr.md
i18n-sync check --staleness-grace 10m --warn-only
i18n-sync check --fix-code-blocks --dry-run
~~~

Kod bloklarını güncellemek için `--dry-run` seçeneğini kaldırın. Commit edilmemiş değişiklikleri olan hedeflere yazılmaz. Bu dosyalardaki kod bloklarını da değiştirmek istiyorsanız `--force` kullanın. Hedefin LF veya CRLF satır sonları korunur. Önizleme, hangi dosyada kaç bloğun değişeceğini gösterir. JSON çıktısına `plannedChanges` eklenir.

ESM API'sini de kullanabilirsiniz:

~~~javascript
import { runSyncCheck } from 'readme-i18n-sync';

const { results, allSynced } = await runSyncCheck({
  cwd: process.cwd(),
  noGit: true
});
console.log({ pairs: results.length, allSynced });
~~~

## Örnekler

[Çalıştırılabilir çok dilli örnekte](examples/README.md) bir Actions workflow'u da var. Örneğin `README.md` / `README.tr.md` ve `docs/en/guide.md` / `docs/tr/guide.md` çiftleri birbiriyle uyumlu.

## Yapılandırma

Kontrol edeceğiniz dizinde `.i18n-sync.json` oluşturun. Yazmadığınız ayarlar varsayılan değerlerini korur. Geçersiz ayarlarda sorunlu anahtar belirtilir ve çıkış kodu 2 olur. [Şema](schema.json), editörde doğrulama yapmanızı da sağlar.

~~~json
{
  "sourceLanguage": "en",
  "patterns": [
    { "source": "README.md", "target": "README.:lang.md" },
    { "source": "docs/en/**/*.{md,markdown}", "target": "docs/:lang/**/*.{md,markdown}" }
  ],
  "checks": { "gitStaleness": true },
  "staleness": { "graceSeconds": 30 },
  "ignoreLanguages": [],
  "ignoreFiles": []
}
~~~

| Seçenek | Davranış |
| --- | --- |
| `--format text/json/github` | Terminal metni (varsayılan), JSON veya Actions bildirimi üretir. `--json` ve `--github` kısayolları da kullanılabilir. |
| `--config path`, `-c path` | Belirtilen yapılandırma dosyasını okur. |
| `--staleness-grace 30s` | `staleness.graceSeconds` değerini değiştirir (varsayılan 0). Birimler: `s`, `m`, `h`, `d`. |
| `--no-git` | Git geçmişine göre güncellik kontrolünü kapatır. |
| `--strict` | Fark varsa çıkış kodu 1 olur (varsayılan). |
| `--warn-only`, `--no-strict` | Farkları gösterir, çıkış kodu 0 olur. Hatalarda yine 2 döner. |
| `--fix-code-blocks` | Farklı kod bloklarını kaynaktan kopyalar. |
| `--dry-run` | Dosyaya yazmadan değişiklikleri gösterir. Fark varsa yine 1 döner. |
| `--force` | Commit edilmemiş değişiklikleri olan hedeflerde düzeltmeye izin verir. |
| `--source path --target path` | Belirtilen belge çiftini kontrol eder. |
| `--help`, `--version` | Yardımı veya sürümü gösterir. |

## Nasıl çalışır?

Ayrıştırıcı; başlıkları, kod bloklarını, bağlantı adreslerini, görsel URL'lerini, tabloları, GitHub uyarılarını ve sürüm numaralarını çıkarır. Sayıları, başlık düzeylerini, tablo sütunlarını, kod dilini ve içeriğini, adresleri, uyarı türlerini ve sürümleri karşılaştırır. İstediğiniz kontrolü `checks` içinde kapatabilirsiniz. Anahtar adları şemada yer alır.

Varsayılan eşleştirme `README.<lang>.md` ve `docs/<lang>/**` dosyalarını bulur. BCP-47 benzeri dil kodları kullanılır. `zh-CN`, `pt_BR` ve `zh-Hans` desteklenir; `draft`, `bak` ve `CHANGELOG` uzantıları çeviri sayılmaz. Hedef kalıbında `:lang` bulunmalıdır. Eski `<lang>` biçimi de kabul edilir.

Git kontrolü, her dosyanın son commit kimliğini ve zamanını karşılaştırır. İki dosya aynı commit'te değişmişse güncel kabul edilir. Ayrı commit'lerde kaynak daha yeniyse ve aradaki süre toleransı aşıyorsa uyarı verilir. Git geçmişi yoksa bu kontrol atlanır. Dosyanın tamamını ilgilendiren uyarılarda hedef satırı yazılmaz. Eksik bağlantı, görsel ve sürümlerde kaynak satırı gösterilir.

Yerel içeriği kontrol dışında bırakmak için öğenin önüne `<!-- i18n-sync-ignore -->` koyun. Bir bölümü atlamak için `<!-- i18n-sync-ignore-start -->` ve `<!-- i18n-sync-ignore-end -->` kullanın.

## Neleri kontrol etmez?

- Metnin anlatımını, dil bilgisini veya okunabilirliğini.
- Çevirinin doğruluğunu ya da anlamın değişip değişmediğini.
- Çevirmenin değiştirdiği bağlantı çapalarının çalışıp çalışmadığını. Bağlantı adresleri yazıldığı gibi karşılaştırılır. Yerelleştirilmiş çapalar için yok sayma işareti gerekebilir.

Kontroller ağ bağlantısı olmadan, yerel olarak çalışır. JSON çıktısı, farklı kod bloklarından içerik taşıyabilir. Paylaşmadan önce gözden geçirin.

## Çıkış kodları

| Kod | Anlamı |
| --- | --- |
| 0 | Belgeler uyumlu, eşleşen çift bulunamadı veya farklar `--warn-only` ile gösterildi. |
| 1 | Yapı farkı var ya da bir belge eksik. |
| 2 | Kullanım, yapılandırma veya çalıştırma hatası var. İzin verilmeyen düzeltmeler de buna dahildir. |

## Geliştirme

Repo dizininde:

~~~bash
npm run lint
npm test
npm pack --dry-run
~~~

Testler Node'un kendi test aracını, yerel örnekleri ve geçici git repolarını kullanır. Git gereklidir. Testler ağa bağlanmaz. CI; Linux ve Windows üzerinde Node 20, 22 ve 24 ile çalışır.

## Katkıda bulunma

[CONTRIBUTING.md](CONTRIBUTING.md), [davranış kuralları](CODE_OF_CONDUCT.md) ve [SECURITY.md](SECURITY.md) dosyalarını okuyun. İngilizce ve Türkçe README dosyalarını birlikte güncelleyin.

## Lisans

[MIT](LICENSE). Telif hakkı (c) 2026 Yusuf Berat Zengin.
