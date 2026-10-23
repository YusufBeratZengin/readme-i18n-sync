# Çok dilli belge örneği

## Çalıştırma

Repodaki bu dizinde çalıştırın:

```bash
node ../bin/i18n-sync.js check
```

Git geçmişi olmadan da çalışması için git kontrolü kapalı.
Yapılandırma, kökteki README dosyalarını ve iki kılavuzu eşleştirir.

## Çıktı

<!-- example-output -->
```text
[OK] README.tr.md (source: README.md, lang: tr)
[OK] docs/tr/guide.md (source: docs/en/guide.md, lang: tr)

Summary:
  Pairs checked: 2 (2 synced, 0 with drift)
  Issues: 0 warnings, 0 errors
```
<!-- /example-output -->

## GitHub Actions

`.github/workflows/docs-sync.yml` dosyasını bu örneklerin kök dizin olduğu çok dilli
repoya kopyalayın. Paket yayımlandıktan sonra workflow pull request'lerde CLI'yi
çalıştırır. Geçmişi kontrol etmek için o repoda `checks.gitStaleness` ayarını açın.

```yaml
name: Documentation sync
on:
  pull_request:
    paths: ['README*.md', 'docs/**', '.i18n-sync.json']
permissions:
  contents: read
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx --yes readme-i18n-sync@0.1.0 check --format github --staleness-grace 10m
```
