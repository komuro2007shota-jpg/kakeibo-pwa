import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { supabase } from './lib/supabase.js';

const defaultCategories = [
  '食費',
  '住居',
  '交通',
  '光熱費',
  '通信',
  '日用品',
  '医療',
  '娯楽',
  '教育',
  'その他'
];

const types = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' }
];

const formatYen = (value) => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(value || 0);
};

const toMonth = (value) => value?.slice(0, 7) || '';
const getPreviousMonth = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 7);
};

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [budgets, setBudgets] = useState({});
  const [budgetDrafts, setBudgetDrafts] = useState({});
  const [copyFromMonth, setCopyFromMonth] = useState(getPreviousMonth);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    type: 'expense',
    category: defaultCategories[0],
    note: ''
  });

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    loadTransactions();
    loadCategories();
    loadBudgets(month);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    loadBudgets(month);
  }, [month, session]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setStatus(`読み込みエラー: ${error.message}`);
    } else {
      setTransactions(data || []);
      setStatus('');
    }
    setLoading(false);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatus('ログインメールを送信しています...');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setStatus(`ログイン失敗: ${error.message}`);
    } else {
      setStatus('メールを確認してログインしてください。');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTransactions([]);
    setCategories(defaultCategories);
    setBudgets({});
    setBudgetDrafts({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.date || !form.amount) return;

    const amountValue = Number(form.amount);
    if (Number.isNaN(amountValue)) {
      setStatus('金額が正しくありません');
      return;
    }

    setLoading(true);
    const payload = {
      date: form.date,
      amount: Math.abs(amountValue),
      type: form.type,
      category: form.category,
      note: form.note.trim(),
      user_id: session.user.id
    };

    const { error } = await supabase.from('transactions').insert(payload);
    if (error) {
      setStatus(`保存エラー: ${error.message}`);
    } else {
      setForm((prev) => ({ ...prev, amount: '', note: '' }));
      await loadTransactions();
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('この明細を削除しますか？')) return;
    setLoading(true);
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      setStatus(`削除エラー: ${error.message}`);
    } else {
      await loadTransactions();
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      setStatus(`カテゴリ読み込みエラー: ${error.message}`);
      setCategories(defaultCategories);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      const seedPayload = defaultCategories.map((name) => ({
        name,
        user_id: session.user.id
      }));
      const { error: seedError } = await supabase.from('categories').insert(seedPayload);
      if (seedError) {
        setStatus(`カテゴリ初期化エラー: ${seedError.message}`);
        setCategories(defaultCategories);
      } else {
        const { data: seeded } = await supabase
          .from('categories')
          .select('*')
          .order('created_at', { ascending: true });
        setCategories((seeded || []).map((item) => item.name));
      }
      setLoading(false);
      return;
    }

    const nextCategories = data.map((item) => item.name);
    setCategories(nextCategories);
    if (!nextCategories.includes(form.category)) {
      setForm((prev) => ({ ...prev, category: nextCategories[0] || defaultCategories[0] }));
    }
    setLoading(false);
  };

  const handleAddCategory = async (event) => {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (!name) return;
    setLoading(true);
    const { error } = await supabase.from('categories').insert({
      name,
      user_id: session.user.id
    });
    if (error) {
      setStatus(`カテゴリ追加エラー: ${error.message}`);
    } else {
      setCategoryDraft('');
      await loadCategories();
    }
    setLoading(false);
  };

  const startEditCategory = (name) => {
    setEditingCategoryId(name);
    setEditingCategoryName(name);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleRenameCategory = async (oldName) => {
    const nextName = editingCategoryName.trim();
    if (!nextName || nextName === oldName) {
      cancelEditCategory();
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('categories')
      .update({ name: nextName })
      .eq('user_id', session.user.id)
      .eq('name', oldName);
    if (error) {
      setStatus(`カテゴリ更新エラー: ${error.message}`);
      setLoading(false);
      return;
    }

    await supabase
      .from('transactions')
      .update({ category: nextName })
      .eq('user_id', session.user.id)
      .eq('category', oldName);

    await loadCategories();
    if (form.category === oldName) {
      setForm((prev) => ({ ...prev, category: nextName }));
    }
    cancelEditCategory();
    setLoading(false);
  };

  const handleDeleteCategory = async (name) => {
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('category', name);

    if (countError) {
      setStatus(`カテゴリ確認エラー: ${countError.message}`);
      return;
    }

    if (count && count > 0) {
      alert('このカテゴリは既に使われています。先に明細のカテゴリを変更してください。');
      return;
    }

    if (!confirm(`カテゴリ「${name}」を削除しますか？`)) return;
    setLoading(true);
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', session.user.id)
      .eq('name', name);
    if (error) {
      setStatus(`カテゴリ削除エラー: ${error.message}`);
    } else {
      await supabase
        .from('budgets')
        .delete()
        .eq('user_id', session.user.id)
        .eq('category', name);
      await loadCategories();
      if (form.category === name) {
        setForm((prev) => ({ ...prev, category: defaultCategories[0] }));
      }
    }
    setLoading(false);
  };

  const loadBudgets = async (targetMonth) => {
    if (!targetMonth) return;
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('month', targetMonth)
      .order('created_at', { ascending: true });
    if (error) {
      setStatus(`予算読み込みエラー: ${error.message}`);
      return;
    }
    const map = {};
    (data || []).forEach((item) => {
      map[item.category] = item.amount;
    });
    setBudgets(map);
    setBudgetDrafts((prev) => {
      const next = { ...prev };
      Object.entries(map).forEach(([category, amount]) => {
        next[category] = amount;
      });
      return next;
    });
  };

  const handleBudgetChange = (name, value) => {
    setBudgetDrafts((prev) => ({ ...prev, [name]: value }));
  };

  const saveBudget = async (name) => {
    const raw = budgetDrafts[name];
    if (raw === '' || raw === undefined) return;
    const amountValue = Number(raw);
    if (Number.isNaN(amountValue) || amountValue < 0) {
      setStatus('予算は0以上の数値で入力してください');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('budgets').upsert({
      user_id: session.user.id,
      month,
      category: name,
      amount: Math.floor(amountValue)
    });
    if (error) {
      setStatus(`予算保存エラー: ${error.message}`);
    } else {
      await loadBudgets(month);
    }
    setLoading(false);
  };

  const copyBudgetsFromMonth = async () => {
    if (!copyFromMonth || copyFromMonth === month) {
      setStatus('コピー元の月を選んでください');
      return;
    }
    if (!confirm(`${copyFromMonth} の予算を ${month} にコピーしますか？`)) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('month', copyFromMonth);
    if (error) {
      setStatus(`予算読み込みエラー: ${error.message}`);
      setLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      setStatus('コピー元の予算がありません');
      setLoading(false);
      return;
    }
    const { error: deleteError } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', session.user.id)
      .eq('month', month);
    if (deleteError) {
      setStatus(`予算削除エラー: ${deleteError.message}`);
      setLoading(false);
      return;
    }
    const payload = data.map((item) => ({
      user_id: session.user.id,
      month,
      category: item.category,
      amount: item.amount
    }));
    const { error: insertError } = await supabase.from('budgets').insert(payload);
    if (insertError) {
      setStatus(`予算コピーエラー: ${insertError.message}`);
    } else {
      await loadBudgets(month);
      setStatus('予算をコピーしました');
    }
    setLoading(false);
  };

  const downloadCsv = (items, filename) => {
    const header = ['日付', '種別', 'カテゴリ', 'メモ', '金額'];
    const lines = items.map((item) => [
      item.date,
      item.type === 'income' ? '収入' : '支出',
      item.category,
      item.note || '',
      item.amount
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCategoriesCsv = () => {
    const header = ['カテゴリ'];
    const lines = categories.map((name) => [name]);
    const csv = [header, ...lines].map((row) => `"${row[0].replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kakeibo-categories.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadBudgetsCsv = () => {
    const header = ['月', 'カテゴリ', '予算'];
    const lines = Object.entries(budgets).map(([category, amount]) => [
      month,
      category,
      amount
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kakeibo-budgets-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadBudgetsCsvAll = async () => {
    const { data, error } = await supabase
      .from('budgets')
      .select('month, category, amount')
      .order('month', { ascending: true });
    if (error) {
      setStatus(`予算CSVエラー: ${error.message}`);
      return;
    }
    const header = ['月', 'カテゴリ', '予算'];
    const lines = (data || []).map((item) => [item.month, item.category, item.amount]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kakeibo-budgets-all.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!categories.includes(form.category)) {
      setForm((prev) => ({ ...prev, category: categories[0] || defaultCategories[0] }));
    }
  }, [categories, form.category]);

  const filtered = useMemo(() => {
    return transactions.filter((item) => toMonth(item.date) === month);
  }, [transactions, month]);

  const stats = useMemo(() => {
    const income = filtered
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
    const expense = filtered
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
    return {
      income,
      expense,
      balance: income - expense
    };
  }, [filtered]);

  const categoryData = useMemo(() => {
    const map = new Map();
    filtered
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        map.set(item.category, (map.get(item.category) || 0) + item.amount);
      });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const categorySpendMap = useMemo(() => {
    const map = {};
    filtered
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        map[item.category] = (map[item.category] || 0) + item.amount;
      });
    return map;
  }, [filtered]);

  const budgetChartData = useMemo(() => {
    return categories
      .map((name) => {
        const budget = budgets[name] || 0;
        const spent = categorySpendMap[name] || 0;
        const remaining = Math.max(budget - spent, 0);
        const over = Math.max(spent - budget, 0);
        return { name, budget, spent, remaining, over };
      })
      .filter((item) => item.budget > 0 || item.spent > 0);
  }, [budgets, categories, categorySpendMap]);

  const monthlyData = useMemo(() => {
    const map = new Map();
    transactions.forEach((item) => {
      const key = toMonth(item.date);
      const current = map.get(key) || { month: key, income: 0, expense: 0 };
      if (item.type === 'income') current.income += item.amount;
      if (item.type === 'expense') current.expense += item.amount;
      map.set(key, current);
    });
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({
        ...entry,
        balance: entry.income - entry.expense
      }));
  }, [transactions]);

  if (!session) {
    return (
      <div className="login card">
        <h1>家計簿へようこそ</h1>
        <p className="notice">
          メールアドレスにログインリンクを送ります。リンクを開くとログインできます。
        </p>
        <form onSubmit={handleLogin}>
          <label>
            メールアドレス
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={loading}>
            ログインリンクを送信
          </button>
        </form>
        {status && <p className="notice">{status}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>家計簿</h1>
          <p>今日の支出が、未来の安心になる。</p>
        </div>
        <div>
          <button className="ghost" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>

      <section className="card">
        <form onSubmit={handleSubmit}>
          <label>
            日付
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
          </label>
          <label>
            金額
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="例: 1200"
              required
            />
          </label>
          <label>
            種別
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              {types.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            カテゴリ
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            メモ
            <input
              type="text"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="例: スーパー"
            />
          </label>
          <button type="submit" disabled={loading}>
            登録する
          </button>
        </form>
        {status && <p className="notice">{status}</p>}
      </section>

      <section className="card">
        <div className="grid">
          <div>
            <h2>月別サマリー</h2>
            <p className="notice">月を切り替えて集計を確認できます。</p>
          </div>
          <div className="summary-actions">
            <label>
              対象月
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button
                className="secondary"
                type="button"
                onClick={() => downloadCsv(filtered, `kakeibo-${month}.csv`)}
              >
                CSV (この月)
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => downloadCsv(transactions, 'kakeibo-all.csv')}
              >
                CSV (全期間)
              </button>
            </div>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <h3>収入</h3>
            <p>{formatYen(stats.income)}</p>
          </div>
          <div className="stat">
            <h3>支出</h3>
            <p>{formatYen(stats.expense)}</p>
          </div>
          <div className="stat">
            <h3>収支</h3>
            <p>{formatYen(stats.balance)}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>バックアップ</h2>
        <p className="notice">CSVでデータを保存できます。</p>
        <div className="button-row">
          <button
            className="secondary"
            type="button"
            onClick={() => downloadCsv(transactions, 'kakeibo-all.csv')}
          >
            明細CSV（全期間）
          </button>
          <button className="secondary" type="button" onClick={downloadCategoriesCsv}>
            カテゴリCSV
          </button>
          <button className="secondary" type="button" onClick={downloadBudgetsCsvAll}>
            予算CSV（全期間）
          </button>
          <button className="secondary" type="button" onClick={downloadBudgetsCsv}>
            予算CSV（この月）
          </button>
        </div>
      </section>

      <section className="card">
        <h2>グラフ</h2>
        <div className="charts">
          <div>
            <h3>カテゴリ別支出</h3>
            {categoryData.length === 0 ? (
              <p className="notice">支出がありません。</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1f4d45" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h3>月次収支推移</h3>
            {monthlyData.length === 0 ? (
              <p className="notice">データがありません。</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#1f4d45" />
                  <Line type="monotone" dataKey="expense" stroke="#b84a4a" />
                  <Line type="monotone" dataKey="balance" stroke="#3a6c8a" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h3>予算の達成状況</h3>
            {budgetChartData.length === 0 ? (
              <p className="notice">予算または支出がありません。</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="spent" stackId="a" fill="#1f4d45" name="支出" />
                  <Bar dataKey="remaining" stackId="a" fill="#3a6c8a" name="残り" />
                  <Bar dataKey="over" stackId="a" fill="#b84a4a" name="超過" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>明細</h2>
        {loading && <p className="notice">読み込み中...</p>}
        {filtered.length === 0 ? (
          <p className="notice">この月の明細はまだありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>日付</th>
                <th>種別</th>
                <th>カテゴリ</th>
                <th>メモ</th>
                <th>金額</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>
                    <span className="badge">
                      {item.type === 'income' ? '収入' : '支出'}
                    </span>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.note || '-'}</td>
                  <td className={`amount ${item.type === 'income' ? 'positive' : 'negative'}`}>
                    {formatYen(item.amount)}
                  </td>
                  <td>
                    <button className="secondary" onClick={() => handleDelete(item.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>カテゴリ設定</h2>
        <form onSubmit={handleAddCategory} className="category-form">
          <label>
            新しいカテゴリ
            <input
              type="text"
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              placeholder="例: 交際費"
            />
          </label>
          <button type="submit" disabled={loading}>
            追加する
          </button>
        </form>
        <div className="category-list">
          {categories.map((name) => (
            <div key={name} className="category-row">
              {editingCategoryId === name ? (
                <>
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(event) => setEditingCategoryName(event.target.value)}
                  />
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => handleRenameCategory(name)}
                      className="secondary"
                    >
                      保存
                    </button>
                    <button type="button" onClick={cancelEditCategory} className="ghost">
                      キャンセル
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="category-info">
                    <span>{name}</span>
                    <span className="notice">
                      今月の支出: {formatYen(categorySpendMap[name] || 0)}
                    </span>
                  </div>
                  <div className="button-row">
                    <button type="button" onClick={() => startEditCategory(name)} className="ghost">
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(name)}
                      className="secondary"
                    >
                      削除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="category-budgets">
          <div className="budget-header">
            <h3>今月の予算（カテゴリ別）</h3>
            <div className="button-row">
              <label className="budget-copy">
                コピー元
                <input
                  type="month"
                  value={copyFromMonth}
                  onChange={(event) => setCopyFromMonth(event.target.value)}
                />
              </label>
              <button type="button" className="secondary" onClick={copyBudgetsFromMonth}>
                今月にコピー
              </button>
            </div>
          </div>
          {categories.map((name) => {
            const remaining = (budgets[name] || 0) - (categorySpendMap[name] || 0);
            const isOver = remaining < 0;
            return (
              <div key={`${name}-budget`} className={`category-row ${isOver ? 'over-budget' : ''}`}>
                <div className="category-info">
                  <span>{name}</span>
                  <span className={`notice ${isOver ? 'over-budget-text' : ''}`}>
                    残り: {formatYen(remaining)} {isOver ? '（超過）' : ''}
                  </span>
                </div>
                <div className="button-row">
                  <input
                    type="number"
                    min="0"
                    value={budgetDrafts[name] ?? ''}
                    onChange={(event) => handleBudgetChange(name, event.target.value)}
                    placeholder="例: 30000"
                  />
                  <button type="button" className="secondary" onClick={() => saveBudget(name)}>
                    保存
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
