window.__ModuleLoader__.load({
  id: 'dsh-serper-provider',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /**
     * The browser half of the Serper search provider: the settings form the
     * Plugins page renders for this bundle's row, over the config section the
     * Host serves for `dsh-serper-provider#web-search-serper`.
     *
     * The API key is the one control that does not live in the section: its
     * literal never rides a response, so the page learns only whether one is
     * configured and writes it through the credentials domain, addressed by the
     * reference the section names. It is staged with the rest of the form, so one
     * save covers everything the page shows.
     *
     * Plain React with theme tokens; no Harness Client package import.
     */
    const NS = 'settings.webSearchSerper';
    /** The settings namespace the Host serves for this row's config section. */
    const SETTINGS_NS = 'web-search-serper';
    /** The `plugins.row.config` key this bundle's row owns (`<package name>#<row id>`). */
    const ROW_CONFIG_KEY = 'dsh-serper-provider#web-search-serper';
    /** Credential reference the provider resolves when the section names none. */
    const DEFAULT_API_KEY_REF = 'SERPER_API_KEY';
    /** Scalar section fields the form stages, in display order. */
    const FIELDS = [
      { key: 'apiKeyEnv', label: 'credentialRef', numeric: false },
      { key: 'endpoint', label: 'endpoint', numeric: false },
      { key: 'num', label: 'num', numeric: true },
      { key: 'page', label: 'page', numeric: true },
      { key: 'gl', label: 'gl', numeric: false },
      { key: 'hl', label: 'hl', numeric: false }
    ];

    const en = {
      title: 'Serper web search',
      description: 'Search provider for the web capability seam; the web_search tool comes from dsh-tool-web.',
      apiKey: 'API key',
      apiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
      apiKeySet: 'A key is configured.',
      apiKeyUnset: 'No key is configured, so this provider cannot search.',
      credentialRef: 'Credential reference',
      credentialRefHint: 'The name the provider resolves the key from.',
      endpoint: 'Endpoint',
      endpointHint: 'Leave blank to use the provider default.',
      num: 'Results per request',
      numHint: 'How many results one search asks Serper for; the tool still caps what the model sees.',
      page: 'Result page',
      pageHint: 'Which page of Serper results to read.',
      gl: 'Country (gl)',
      glHint: 'Serper country code, for example us.',
      hl: 'Language (hl)',
      hlHint: 'Serper language code, for example en.',
      overridden: 'Overridden',
      reset: 'Reset to default',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      save: 'Save',
      saving: 'Saving…',
      discard: 'Discard',
      saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
      invalidNumber: 'Enter a number, or leave blank to use the default.'
    };

    const zh = {
      title: 'Serper 网页搜索',
      description: 'web 能力 seam 的搜索提供方；面向模型的 web_search 工具由 dsh-tool-web 提供。',
      apiKey: 'API Key',
      apiKeyHint: '不写入设置文件。留空表示保持当前密钥。',
      apiKeySet: '已配置密钥。',
      apiKeyUnset: '未配置密钥，因此该提供方无法搜索。',
      credentialRef: '凭据引用',
      credentialRefHint: '提供方解析密钥时使用的名称。',
      endpoint: '接口地址',
      endpointHint: '留空则使用提供方默认地址。',
      num: '单次请求结果数',
      numHint: '一次搜索向 Serper 请求多少条结果；工具仍会限制模型看到的数量。',
      page: '结果页码',
      pageHint: '读取 Serper 的第几页结果。',
      gl: '国家（gl）',
      glHint: 'Serper 国家代码，例如 us。',
      hl: '语言（hl）',
      hlHint: 'Serper 语言代码，例如 en。',
      overridden: '已覆盖',
      reset: '恢复默认',
      readOnly: '本部署的设置为只读。',
      unavailable: '该插件当前未加载，暂时无法配置。',
      save: '保存',
      saving: '保存中…',
      discard: '放弃修改',
      saveFailed: '本部署没有接受这些值，已保留供你修改。',
      invalidNumber: '请填数字；留空表示使用默认值。'
    };

    /** A section value as display text; an unset field shows blank for its default. */
    function textOf(value) {
      return value === undefined || value === null ? '' : String(value);
    }

    /**
     * Staged form over the row's config section plus the credential the section
     * names. The snapshot is plain JSON and is only replaced when something
     * actually changed, so the page's selector hook sees a stable reference.
     */
    var CardController = class {
      ctx;
      form;
      listeners = new Set();
      draft = new Map();
      saving = false;
      failed = false;
      credential = { ref: DEFAULT_API_KEY_REF, configured: false, writable: false };
      snapshot;
      unsubscribe;

      constructor(form, ctx) {
        this.form = form;
        this.ctx = ctx;
        this.credentials = ctx.get?.('remote.credentials') ?? ctx.remote?.credentials;
        this.snapshot = this.project();
        if (typeof form.subscribe === 'function') this.unsubscribe = form.subscribe(() => { this.refresh(); this.readCredential(); });
        this.readCredential();
      }

      project(form = this.form) {
        const state = this.stateOf(form);
        const value = state.value ?? {};
        const user = state.user ?? {};
        return {
          status: state.status,
          writable: state.writable,
          fields: FIELDS.map((field) => {
            const entry = this.draft.get(field.key);
            return {
              key: field.key,
              label: field.label,
              text: entry !== undefined ? entry.text : textOf(value[field.key]),
              invalid: entry !== undefined && entry.invalid === true,
              // The row's patch layer supplies these values; only a settings-layer
              // write is an override, so `user` decides the marker, not `value`.
              overridden: entry !== undefined || user[field.key] !== undefined
            };
          }),
          apiKey: {
            text: this.draft.has('apiKey') ? this.draft.get('apiKey').text : '',
            configured: this.credential.configured,
            writable: this.credential.writable
          },
          saving: this.saving,
          failed: this.failed
        };
      }

      /** Replace the snapshot only when its content changed, then notify. */
      refresh() {
        const next = this.project();
        if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
        this.snapshot = next;
        for (const listener of this.listeners) listener();
      }

      // Arrows, not methods: the page hands `subscribe`, `edit`, `resetField`,
      // `discard`, and `save` to React event handlers and to
      // `useSyncExternalStore`, so an unbound `this` would throw.
      subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
      };

      getSnapshot() {
        return this.snapshot;
      }

      edit = (key, text) => {
        const entry = { text, invalid: isNumeric(key) && text.length > 0 && !Number.isInteger(Number(text)) };
        this.draft.set(key, entry);
        this.failed = false;
        this.refresh();
      };

      /** The current snapshot for a form, whether it is the shared controller or the page's face. */
      stateOf(form) {
        if (typeof form.getSnapshot === 'function') return form.getSnapshot();
        return form.state ?? {};
      }

      /** Write one field through `set` or the `mutate` face, so either shape works. */
      async put(key, value) {
        const form = this.form;
        if (typeof form.set === 'function') return await form.set(key, value);
        if (typeof form.mutate === 'function') return await form.mutate([{ op: 'set', path: [key], value }]);
        return false;
      }

      async clear(key) {
        const form = this.form;
        if (typeof form.unset === 'function') return await form.unset(key);
        if (typeof form.mutate === 'function') return await form.mutate([{ op: 'unset', path: [key] }]);
        return false;
      }

      /** Clear one staged edit; when the Host is writable, clear the field itself. */
      resetField = async (key) => {
        this.draft.delete(key);
        if (this.stateOf(this.form).writable === true) await this.clear(key);
        this.refresh();
      };

      /** Apply every staged edit; one save covers the key and the section together. */
      save = async () => {
        if (this.draft.size === 0) return true;
        this.saving = true;
        this.failed = false;
        this.refresh();
        let ok = true;
        for (const [key, entry] of [...this.draft]) {
          if (entry.invalid === true) { ok = false; continue; }
          if (key === 'apiKey') {
            if (entry.text.length === 0) continue;
            if (!(await this.writeKey(entry.text))) ok = false;
            continue;
          }
          if (entry.text.length === 0) {
            if (!(await this.clear(key))) ok = false;
            continue;
          }
          if (!(await this.put(key, isNumeric(key) ? Number(entry.text) : entry.text))) ok = false;
        }
        this.saving = false;
        this.failed = !ok;
        if (ok) this.draft.clear();
        this.refresh();
        return ok;
      };

      discard = () => {
        this.draft.clear();
        this.failed = false;
        this.refresh();
      };

      /**
       * Ask the credentials domain about the reference the section names. The
       * answer is stored with the reference it describes, so a response is
       * published only while it still answers for the reference in force.
       */
      async readCredential() {
        const credentials = this.credentials;
        if (credentials === undefined) return;
        const ref = refOf(this.stateOf(this.form));
        if (ref !== this.credential.ref) this.credential = { ref, configured: false, writable: true };
        const response = await credentials.describe([ref]);
        if (!response.ok || ref !== refOf(this.stateOf(this.form))) return;
        const view = response.value?.[ref];
        this.credential = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true };
        this.refresh();
      }

      async writeKey(value) {
        const credentials = this.credentials;
        if (credentials === undefined) return false;
        await credentials.set(refOf(this.stateOf(this.form)), value);
        await this.readCredential();
        return this.credential.configured;
      }

      /** Release this page's configuration subscription; the shared form stays with its owner. */
      dispose() {
        if (this.unsubscribe !== undefined) this.unsubscribe();
        this.listeners.clear();
      }
    };

    /** The credential reference the section names, or the provider's default. */
    function refOf(snapshot) {
      const declared = snapshot.value?.apiKeyEnv;
      return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF;
    }

    /** Which section fields Serper sends as numbers. */
    function isNumeric(key) {
      return key === 'num' || key === 'page';
    }

    const rowStyle = { display: 'grid', gap: '4px', marginBottom: '12px' };
    const labelStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: 'var(--dsw-alias-label-primary)' };
    const hintStyle = { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' };
    const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '6px', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: '13px' };

    /** One staged section field: label, current value, hint, and its reset action. */
    function FieldRow(props) {
      const { t, row, disabled, onEdit, onReset } = props;
      return h('div', { style: rowStyle }, [
        h('label', { style: labelStyle }, [
          h('span', {}, t(row.label)),
          h('span', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
            row.overridden === true ? h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('overridden')) : null,
            h('button', {
              type: 'button',
              disabled: disabled === true,
              onClick: () => onReset(row.key),
              style: { border: 'none', background: 'transparent', color: 'var(--dsw-alias-brand-primary)', font: 'inherit', fontSize: '11px', cursor: disabled ? 'default' : 'pointer' }
            }, t('reset'))
          ])
        ]),
        h('input', {
          type: 'text',
          value: row.text,
          disabled: disabled === true,
          onChange: (event) => onEdit(row.key, event.target.value),
          style: row.invalid === true ? { ...inputStyle, border: '1px solid var(--dsw-alias-state-error-primary)' } : inputStyle
        }),
        row.invalid === true ? h('p', { style: { ...hintStyle, color: 'var(--dsw-alias-state-error-primary)' } }, t('invalidNumber')) : null,
        h('p', { style: hintStyle }, t(row.label + 'Hint'))
      ]);
    }

    /** The credential control: it shows state, never the stored value. */
    function SecretRow(props) {
      const { t, apiKey, disabled, onEdit } = props;
      return h('div', { style: rowStyle }, [
        h('label', { style: labelStyle }, [
          h('span', {}, t('apiKey')),
          h('span', { style: { fontSize: '11px', color: apiKey.configured ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)' } }, apiKey.configured ? t('apiKeySet') : t('apiKeyUnset'))
        ]),
        h('input', {
          type: 'password',
          value: apiKey.text,
          disabled: disabled === true,
          onChange: (event) => onEdit('apiKey', event.target.value),
          style: inputStyle
        }),
        h('p', { style: hintStyle }, t('apiKeyHint'))
      ]);
    }

    /** Render the row's one-liner, or its settings form, as the Plugins page asks. */
    function Card(props) {
      const t = props.t ?? ((key) => en[key] ?? key);
      const card = props.card;
      const state = props.useSerperCard !== undefined ? props.useSerperCard((snapshot) => snapshot) : card.getSnapshot();
      // The page's `props.form` is a projection ({ state, mutate }) of the same shared
      // form this controller holds; only the controller knows the staged edits, so the
      // render must read the controller's snapshot, not the projection. Reading the
      // projection here made every typed value invisible.
      const live = state;
      if (props.view === 'summary') return t('description');
      if (live.status !== 'ready') return h('p', { style: hintStyle }, t('unavailable'));
      const disabled = live.writable !== true;
      return h('form', { onSubmit: (event) => { event.preventDefault(); card.save(); } }, [
        h(SecretRow, { t, apiKey: live.apiKey, disabled, onEdit: card.edit }),
        ...live.fields.map((row) => h(FieldRow, { t, row, disabled, onEdit: card.edit, onReset: card.resetField })),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' } }, [
          h('button', {
            type: 'submit',
            disabled: disabled === true || live.saving === true,
            style: { padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-bg-base)', font: 'inherit', fontSize: '13px', cursor: disabled ? 'default' : 'pointer' }
          }, live.saving ? t('saving') : t('save')),
          h('button', {
            type: 'button',
            onClick: card.discard,
            style: { padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-l1)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: '13px', cursor: 'pointer' }
          }, t('discard')),
          h('span', { style: live.failed ? { ...hintStyle, color: 'var(--dsw-alias-state-error-primary)' } : hintStyle }, live.failed ? t('saveFailed') : disabled === true ? t('readOnly') : '')
        ])
      ]);
    }

    return {
      // Only `slots` and `locale` are required; the settings domain and the
      // credentials domain are read through `ctx.get`, so a profile without one
      // shows a message instead of failing activation.
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-web-search-serper: dictionaries');
        // `plugins.row.config` is keyed by `<package name>#<row id>`; the settings
        // form for the same row is keyed by the row id. Registering here makes the
        // row gain its configure control; when the Host does not serve the
        // namespace, the page renders the "not loaded" message instead of a form.
        const configForms = ctx.get('configForms');
        if (configForms === undefined) return;
        const card = new CardController(configForms.get(SETTINGS_NS), ctx);
        ctx.effect(() => () => card.dispose(), 'dsh-web-search-serper: form subscription');
        ctx.effect(() => ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: ROW_CONFIG_KEY,
          label: () => t('title'),
          locale: NS,
          inject: () => ({
            card,
            hooks: { serperCard: card }
          })
        }, Card)), 'dsh-web-search-serper: row configuration page');
      }
    };
  }
});
