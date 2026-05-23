/* MODULE: DB */
VC.db = {
  isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  },

  isBackendReady() {
    const { supabaseUrl, supabaseKey, edgeFunctionUrl } = VC.config;
    return Boolean(
      VC.supabase &&
      supabaseUrl &&
      supabaseKey &&
      edgeFunctionUrl &&
      /^https?:\/\//.test(supabaseUrl) &&
      /^https?:\/\//.test(edgeFunctionUrl)
    );
  },

  async signUp(email, password, sellerData) {
    if (!this.isBackendReady()) {
      throw new Error('Supabase is not configured. Start the app with npm start and verify /api/config returns your env values.');
    }
    const { data: authData, error: authError } = await VC.supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const { data: seller, error: sellerError } = await VC.supabase
      .from('sellers')
      .insert({
        auth_id: authData.user.id,
        name: sellerData.name,
        business_name: sellerData.businessName,
        email,
        location: sellerData.location || 'Kashmir, India',
        plan: 'starter'
      })
      .select()
      .single();

    if (sellerError) throw sellerError;
    VC.state.seller = seller;
    VC.state.save();
    return seller;
  },

  async signIn(email, password) {
    if (!this.isBackendReady()) {
      throw new Error('Supabase is not configured. Start the app with npm start and verify /api/config returns your env values.');
    }
    const { data, error } = await VC.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: seller } = await VC.supabase
      .from('sellers')
      .select('*')
      .eq('auth_id', data.user.id)
      .single();

    VC.state.seller = seller;
    VC.state.save();
    return seller;
  },

  async signOut() {
    if (this.isBackendReady()) {
      await VC.supabase.auth.signOut();
    }
    VC.state.seller = null;
    VC.state.batches = [];
    VC.state.scans = [];
    VC.state.save();
    VC.router.go('');
  },

  async restoreSession() {
    if (!this.isBackendReady()) return null;
    const { data: { session } } = await VC.supabase.auth.getSession();
    if (!session) return null;

    const { data: seller } = await VC.supabase
      .from('sellers')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();

    if (seller) {
      VC.state.seller = seller;
      VC.state.save();
    }
    return seller;
  },

  async createBatch(formData) {
    if (!VC.state.seller) throw new Error('Not authenticated');

    const batchId = VC.crypto.generateBatchId();
    const hmacSecret = await VC.crypto.generateSecret();
    const scanPolicy = formData.scanPolicy || 'limited';
    const maxScansPerUnit = scanPolicy === 'limited'
      ? Math.max(1, parseInt(formData.maxScansPerUnit, 10) || 3)
      : scanPolicy === 'single' ? 1 : 9999;

    const batch = {
      id: batchId,
      seller_id: VC.state.seller.id,
      product: formData.product,
      category: formData.category,
      origin: formData.origin,
      farm: formData.farm,
      harvest_date: formData.harvest,
      units: formData.units,
      cert_number: formData.cert || null,
      supply_chain: formData.supplyChain,
      hmac_secret: hmacSecret,
      scan_policy: scanPolicy,
      max_scans_per_unit: maxScansPerUnit,
      status: 'active'
    };

    const canWriteRemote = this.isBackendReady()
      && !VC.config.demoMode
      && this.isUuid(VC.state.seller.id);

    if (!canWriteRemote) {
      const tokens = await VC.crypto.generateBatchTokens({
        ...batch,
        units: formData.units
      });
      const localBatch = {
        ...batch,
        sellerName: VC.state.seller.business_name || VC.state.seller.name,
        harvest: formData.harvest,
        cert: formData.cert || null,
        supplyChain: formData.supplyChain,
        createdAt: Date.now(),
        tokens
      };
      VC.state.batches.unshift(localBatch);
      VC.state.save();
      return { batch: localBatch, tokens };
    }

    const { data, error } = await VC.supabase.from('batches').insert(batch).select().single();
    if (error) throw error;

    const tokens = await VC.crypto.generateBatchTokens({ ...data, hmac_secret: hmacSecret });
    const tokenRows = tokens.map((t) => ({
      batch_id: batchId,
      unit_number: t.unit,
      token: t.token,
      token_jti: t.jti
    }));
    const { error: tokenError } = await VC.supabase.from('qr_tokens').insert(tokenRows);
    if (tokenError) throw tokenError;

    await VC.supabase.rpc('increment', {
      table_name: 'sellers',
      column_name: 'total_tags_issued',
      row_id: VC.state.seller.id,
      amount: formData.units
    });

    VC.state.batches.unshift({ ...data, tokens });
    VC.state.save();
    return { batch: data, tokens };
  },

  async getBatches() {
    if (!VC.state.seller) return [];
    if (!this.isBackendReady()) {
      return VC.state.batches || [];
    }
    const { data, error } = await VC.supabase
      .from('batches')
      .select('*')
      .eq('seller_id', VC.state.seller.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    VC.state.batches = data || [];
    VC.state.save();
    return data || [];
  },

  async getBatchTokens(batchId) {
    const localBatch = VC.state.batches.find((b) => b.id === batchId);
    if (localBatch?.tokens?.length) {
      return localBatch.tokens.map((t) => ({
        unit_number: t.unit ?? t.unit_number,
        token: t.token,
        token_jti: t.jti
      }));
    }
    if (!this.isBackendReady()) {
      if (!localBatch) return [];
      const units = localBatch.units || 1;
      return Array.from({ length: units }, (_, idx) => ({
        unit_number: idx + 1,
        token: batchId
      }));
    }
    const { data, error } = await VC.supabase
      .from('qr_tokens')
      .select('*')
      .eq('batch_id', batchId)
      .order('unit_number', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getBatch(id) {
    const local = VC.state.batches.find((b) => b.id === id);
    if (local) return local;
    if (!this.isBackendReady()) return null;
    const { data } = await VC.supabase.from('batches').select('*').eq('id', id).single();
    return data || null;
  },

  _localScanKey(token, batchId) {
    return token && token.length > 20 ? token : `${batchId}:legacy`;
  },

  _checkLocalScanPolicy(batch, token) {
    const policy = batch.scan_policy || 'limited';
    const max = batch.max_scans_per_unit ?? 3;
    const key = this._localScanKey(token, batch.id);
    const used = VC.state.tokenScans[key] || 0;

    if (policy === 'single' && used >= 1) {
      return {
        ok: false,
        reason: 'ALREADY_REDEEMED',
        message: 'This one-time seal was already redeemed in demo mode.',
        used
      };
    }
    if (policy === 'limited' && used >= max) {
      return {
        ok: false,
        reason: 'SCAN_LIMIT_REACHED',
        message: `Scan limit reached (${max} per unit).`,
        used,
        max
      };
    }
    return { ok: true, used, max, policy, remaining: policy === 'unlimited' ? null : Math.max(0, (policy === 'single' ? 1 : max) - used - 1) };
  },

  async verifyQR(token) {
    const useLocalVerification = !this.isBackendReady() || VC.config.demoMode;
    if (useLocalVerification) {
      const decoded = VC.crypto.decodeTokenPayload(token);
      const batchId = decoded?.bid || (String(token).startsWith('VC-') ? token : null);
      const batch = VC.state.batches.find((b) => b.id === batchId);
      if (!batch) {
        return {
          verified: false,
          reason: 'NOT_FOUND',
          message: 'This product is not registered in demo mode.'
        };
      }

      const policyCheck = this._checkLocalScanPolicy(batch, token);
      if (!policyCheck.ok) {
        return {
          verified: false,
          reason: policyCheck.reason,
          message: policyCheck.message,
          batch_id: batch.id,
          product: batch.product,
          scan_policy: policyCheck.policy
        };
      }

      const key = this._localScanKey(token, batch.id);
      VC.state.tokenScans[key] = (VC.state.tokenScans[key] || 0) + 1;
      const usedAfter = VC.state.tokenScans[key];
      const priorScans = usedAfter - 1;

      const locationDisplay = 'Demo Location';
      const scanRow = {
        id: crypto.randomUUID(),
        batchId: batch.id,
        ts: Date.now(),
        location: locationDisplay,
        device: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        flagged: priorScans > 0
      };
      VC.state.scans.unshift(scanRow);
      VC.state.save();

      const unitNumber = decoded?.uid || 1;
      const fingerprint = decoded?.jti ? VC.crypto.shortFingerprint(decoded.jti) : null;

      return {
        verified: true,
        batch: {
          id: batch.id,
          product: batch.product,
          category: batch.category,
          origin: batch.origin,
          farm: batch.farm,
          harvest_date: batch.harvest_date || batch.harvest || '-',
          cert_number: batch.cert_number || batch.cert || null,
          supply_chain: batch.supply_chain || batch.supplyChain || [],
          seller_name: batch.sellerName || VC.state.seller?.business_name || 'Verified Seller',
          seller_location: VC.state.seller?.location || 'Kashmir, India',
          seller_verified: true,
          created_at: batch.created_at || new Date().toISOString(),
          total_scans: VC.state.scans.filter((s) => s.batchId === batch.id).length,
          scan_policy: batch.scan_policy || 'limited',
          max_scans_per_unit: batch.max_scans_per_unit ?? 3
        },
        unit: {
          number: unitNumber,
          fingerprint,
          jti: decoded?.jti,
          first_scan: priorScans === 0,
          scans_used: usedAfter,
          scans_remaining: policyCheck.remaining
        },
        scan_policy: {
          policy: batch.scan_policy || 'limited',
          max_scans: batch.scan_policy === 'unlimited' ? null : (batch.max_scans_per_unit ?? 3),
          scans_used: usedAfter,
          scans_remaining: policyCheck.remaining
        },
        trust_score: priorScans === 0 ? 98 : Math.max(72, 98 - priorScans * 8),
        scan_history: VC.state.scans
          .filter((s) => s.batchId === batch.id)
          .slice(0, 10)
          .map((s) => ({
            location_display: s.location,
            scanned_at: new Date(s.ts).toISOString(),
            device_type: s.device,
            flagged: s.flagged
          })),
        current_scan: {
          location: locationDisplay,
          scanned_at: new Date().toISOString()
        }
      };
    }

    let lat = null;
    let lng = null;
    let city = null;
    let country = null;

    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    if (!lat) {
      try {
        const geoRes = await fetch('https://ipapi.co/json/');
        const geo = await geoRes.json();
        lat = geo.latitude;
        lng = geo.longitude;
        city = geo.city;
        country = geo.country_name;
      } catch {}
    }

    const response = await fetch(VC.config.edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        lat, lng, city, country,
        device_type: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        user_agent: navigator.userAgent
      })
    });
    if (!response.ok) throw new Error('Verification service unavailable');
    return response.json();
  },

  async getScans(limit = 50) {
    if (!VC.state.seller) return [];
    if (!this.isBackendReady()) {
      return VC.state.scans.slice(0, limit);
    }
    const { data, error } = await VC.supabase
      .from('scans')
      .select('*')
      .eq('seller_id', VC.state.seller.id)
      .order('scanned_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    VC.state.scans = (data || []).map((s) => ({
      ...s,
      batchId: s.batch_id,
      ts: new Date(s.scanned_at).getTime(),
      location: s.location_display || 'Unknown',
      device: s.device_type || 'unknown'
    }));
    VC.state.save();
    return VC.state.scans;
  },

  async getFraudAlerts() {
    if (!VC.state.seller) return [];
    if (!this.isBackendReady()) return [];
    const { data, error } = await VC.supabase
      .from('fraud_alerts')
      .select('*')
      .eq('seller_id', VC.state.seller.id)
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  subscribeToScans(callback) {
    if (!this.isBackendReady()) return null;
    if (!VC.state.seller) return null;
    const channel = VC.supabase
      .channel('seller-scans')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scans',
        filter: `seller_id=eq.${VC.state.seller.id}`
      }, (payload) => {
        const row = payload.new;
        const scan = {
          ...row,
          batchId: row.batch_id,
          ts: new Date(row.scanned_at).getTime(),
          location: row.location_display || 'Unknown',
          device: row.device_type || 'unknown'
        };
        VC.state.scans.unshift(scan);
        callback(scan);
      })
      .subscribe();
    return channel;
  },

  subscribeToFraudAlerts(callback) {
    if (!this.isBackendReady()) return null;
    if (!VC.state.seller) return null;
    return VC.supabase
      .channel('fraud-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'fraud_alerts',
        filter: `seller_id=eq.${VC.state.seller.id}`
      }, (payload) => {
        callback(payload.new);
        VC.ui.toast(`⚠ Fraud Alert: ${payload.new.alert_type}`, 'error');
      })
      .subscribe();
  },

  async updateBatchStatus(batchId, status) {
    const allowed = ['active', 'suspended', 'recalled'];
    if (!allowed.includes(status)) throw new Error('Invalid status');

    const local = VC.state.batches.find((b) => b.id === batchId);
    if (local) {
      local.status = status;
      VC.state.save();
    }

    const canWriteRemote = this.isBackendReady()
      && !VC.config.demoMode
      && this.isUuid(VC.state.seller?.id);

    if (canWriteRemote) {
      const { error } = await VC.supabase
        .from('batches')
        .update({ status })
        .eq('id', batchId)
        .eq('seller_id', VC.state.seller.id);
      if (error) throw error;
    }
    return status;
  },

  getAnalytics() {
    const batches = VC.state.batches || [];
    const scans = VC.state.scans || [];
    const byBatch = {};
    const byLocation = {};
    const byCategory = {};
    const byDevice = { mobile: 0, desktop: 0, other: 0 };
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const byDay = Object.fromEntries(last7Days.map((d) => [d, 0]));

    scans.forEach((s) => {
      byBatch[s.batchId] = (byBatch[s.batchId] || 0) + 1;
      const loc = s.location || 'Unknown';
      byLocation[loc] = (byLocation[loc] || 0) + 1;
      const day = new Date(s.ts).toISOString().slice(0, 10);
      if (byDay[day] != null) byDay[day] += 1;
      const dev = (s.device || '').toLowerCase();
      if (dev.includes('mobile')) byDevice.mobile += 1;
      else if (dev.includes('desktop')) byDevice.desktop += 1;
      else byDevice.other += 1;
    });

    batches.forEach((b) => {
      const cat = b.category || 'custom';
      const count = scans.filter((s) => s.batchId === b.id).length;
      byCategory[cat] = (byCategory[cat] || 0) + count;
    });

    const topBatches = Object.entries(byBatch)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => {
        const batch = batches.find((b) => b.id === id);
        return { id, count, product: batch?.product || id };
      });

    const topLocations = Object.entries(byLocation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const maxDay = Math.max(1, ...Object.values(byDay));
    const scanTrend = last7Days.map((day) => ({
      day,
      label: new Date(day).toLocaleDateString('en-IN', { weekday: 'short' }),
      count: byDay[day] || 0,
      pct: Math.round(((byDay[day] || 0) / maxDay) * 100)
    }));

    const redemptionRate = batches.length
      ? Math.round(
        (scans.length / Math.max(1, batches.reduce((a, b) => a + (b.units || 0), 0))) * 100
      )
      : 0;

    return {
      totalScans: scans.length,
      totalBatches: batches.length,
      totalTags: batches.reduce((a, b) => a + (b.units || 0), 0),
      flaggedScans: scans.filter((s) => s.flagged).length,
      topBatches,
      topLocations,
      byCategory,
      byDevice,
      scanTrend,
      redemptionRate: Math.min(100, redemptionRate)
    };
  },

  buildDppExport(batch) {
    const tokens = batch.tokens || [];
    return {
      '@context': 'https://verifychain.in/dpp/v1',
      type: 'DigitalProductPassport',
      issuedAt: new Date().toISOString(),
      issuer: {
        name: VC.state.seller?.business_name || VC.state.seller?.name,
        location: VC.state.seller?.location,
        verified: VC.state.seller?.verified || false
      },
      product: {
        batchId: batch.id,
        name: batch.product,
        category: batch.category,
        origin: batch.origin,
        producer: batch.farm,
        harvestDate: batch.harvest_date || batch.harvest,
        certificationNumber: batch.cert_number || batch.cert || null,
        units: batch.units,
        scanPolicy: batch.scan_policy || 'limited',
        maxScansPerUnit: batch.max_scans_per_unit ?? 3,
        status: batch.status || 'active'
      },
      supplyChain: batch.supply_chain || batch.supplyChain || [],
      units: tokens.map((t) => ({
        unitNumber: t.unit ?? t.unit_number,
        fingerprint: t.fingerprint || (t.jti ? VC.crypto.shortFingerprint(t.jti) : null),
        verifyUrl: t.token ? VC.crypto.buildVerifyUrl(t.token) : null
      })),
      compliance: {
        euDppReady: true,
        cryptographicSeal: 'HMAC-SHA256',
        uniqueTokenPerUnit: true
      }
    };
  },

  downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  async seedDemo() {
    if (!VC.state.seller) return;
    const existing = await this.getBatches();
    if (existing.length > 0) return;

    const demoBatches = [
      {
        product: 'Kashmiri Saffron Grade A',
        category: 'saffron',
        origin: 'Pampore, Pulwama District, J&K',
        farm: 'Wani Family Farm (Est. 1962)',
        harvest: 'October 2025',
        units: 50,
        cert: 'KVIB-K-2025-7821',
        supplyChain: ['Wani Family Farm - Pampore', 'KVIB Certification Lab', 'Premium Processing Unit', 'Wani Premium Exports']
      },
      {
        product: 'Pashmina Shawl - Hand-woven',
        category: 'pashmina',
        origin: 'Srinagar, Kashmir Valley',
        farm: 'Kashmir Loom Collective',
        harvest: 'August 2025',
        units: 12,
        cert: 'KVIB-P-2025-4432',
        supplyChain: ['Kashmir Loom Collective', 'Hand-spinning artisans - Srinagar', 'Quality Certification Lab', 'Wani Premium Exports']
      }
    ];

    for (const b of demoBatches) {
      await this.createBatch(b);
    }
  }
};
