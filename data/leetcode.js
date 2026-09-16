/* LeetCode 刷题模块 —— window.LC_INTRO / window.LC_GROUPS
   hints 是分层提示（先看第一条，还不行再看第二条）；key 是解法要点，默认藏起来
*/
window.LC_INTRO = {
title: "算法题：花最少的时间拿到够用的分",
body: `算法题在 ML 岗位里的定位要摆正：**它不是加分项，是门槛项**。写不出来直接挂，写得漂亮也不会因此录用你 —— 真正拉开差距的是你的项目和 LLM 深度。

所以策略很明确：**用最少的时间通过这一关，把省下的时间投到项目上。**

### 三条原则

**① 不要刷 500 题。** 把下面这 60 题刷两遍，比乱刷 300 题有用得多。这些题覆盖了 90% 的面试考点，而且题与题之间是有结构的 —— 掌握一个模式就能解一类题。

**② 按模式刷，不要按题号刷。** 同一个模式的题连着做，第三题的时候你会有「啊这不就是刚才那个套路」的感觉。这种感觉就是你要的东西。

**③ 卡住 20 分钟就看提示，别硬耗。** 死磕两小时想出来的收益，远不如看完思路后自己完整写一遍、三天后再默写一遍。**刷题练的是模式识别，不是智商。**

### 怎么用这个模块

每题给了三样东西：
- **为什么考它** —— 它在训练你哪个能力
- **分层提示** —— 卡住了先看第一条，还不行再看第二条，尽量别直接翻答案
- **解法要点** —— 默认折叠。看之前先问自己「我真的想了 20 分钟吗」

做完标记状态：**独立做出 / 看了提示 / 没做出来**。标了「没做出来」的题，一周后会提醒你回来重做。

### 时间预算

按每天 2 题、每题 30 分钟算，**第一遍 30 天**。第二遍只做标记为「看了提示」和「没做出来」的，大约 10 天。总共 6 周左右，和路线图的其他部分并行推进。

> **面试时的关键动作**：拿到题**先说思路再写代码**。一句「我先想想…… 我打算用哈希表把时间复杂度从 O(n²) 降到 O(n)，因为…」能让面试官立刻知道你在正确的轨道上。闷头写代码是大忌 —— 万一方向错了，面试官都没机会救你。`
};

window.LC_GROUPS = [
{
key:"hash", name:"数组与哈希表", color:"#7aa2f7",
pattern:`**核心思想：用空间换时间。**

暴力解法通常是两层循环 O(n²)，因为你要「对每个元素，去找另一个满足条件的元素」。哈希表把「查找」从 O(n) 降到 O(1)，整体就降到 O(n)。

**识别信号**：题目里出现「找两个数」「出现次数」「是否存在」「去重」「分组」，先想哈希表。

**Python 常用工具**：
\`\`\`python
from collections import Counter, defaultdict
Counter(nums)              # 统计频次
defaultdict(list)          # 自动初始化的字典，做分组神器
set(nums)                  # 去重 / O(1) 判存在
\`\`\``,
problems:[
{n:1, name:"两数之和", slug:"two-sum", lv:"易", must:true,
why:"最经典的入门题。它教会你「边遍历边建表」这个核心套路 —— 不需要先建完表再查，一次遍历就够。",
hints:["暴力是两层循环 O(n²)。想想：遍历到 x 时，你其实是在找 target - x 有没有出现过。","用一个字典存「见过的数字 → 它的下标」。遍历到 x 时先查字典里有没有 target-x，没有再把 x 存进去。"],
key:"一次遍历 + 哈希表。对每个 x，先查 `target-x` 是否在字典中（说明配对成功），否则把 `x → 当前下标` 存入。注意顺序：**先查后存**，否则 target 是 x 两倍时会把自己配给自己。",
cx:"时间 O(n)，空间 O(n)"},

{n:242, name:"有效的字母异位词", slug:"valid-anagram", lv:"易",
why:"频次统计的最小案例。面试官可能追问「如果是 Unicode 怎么办」「如果内存受限怎么办」。",
hints:["两个字符串是异位词，当且仅当每个字符出现的次数完全相同。","用 Counter 统计两边，直接比较是否相等。或者排序后比较（O(n log n)，但空间 O(1)）。"],
key:"`Counter(s) == Counter(t)`，O(n)。追问排序解法 `sorted(s)==sorted(t)` 是 O(n log n) 但不需要额外哈希表。Unicode 场景下 Counter 更好，固定 26 字母时可以用长度 26 的数组，常数更小。",
cx:"时间 O(n)，空间 O(k) k 为字符集大小"},

{n:49, name:"字母异位词分组", slug:"group-anagrams", lv:"中", must:true,
why:"教你「设计一个 key」这个高频技巧 —— 很多分组问题的难点就是想出用什么当 key。",
hints:["互为异位词的字符串，有什么东西是完全相同的？","把每个字符串排序后的结果当作 key，用 defaultdict(list) 分组。"],
key:"用 `''.join(sorted(s))` 当 key，`defaultdict(list)` 收集。进阶优化：用 26 个字母的计数元组当 key，避免排序的 log 因子。",
cx:"时间 O(n·k log k)，n 个字符串每个长 k"},

{n:347, name:"前 K 个高频元素", slug:"top-k-frequent-elements", lv:"中", must:true,
why:"Top-K 是面试和实际工作里都极其常见的模式。而且这题有三种解法，能体现你的复杂度意识。",
hints:["先统计频次，然后问题变成「从频次表里选出最大的 K 个」。","方法一：堆，O(n log k)。方法二：桶排序 —— 频次最大只能是 n，所以可以开 n+1 个桶按频次放，从后往前取，O(n)。"],
key:"**桶排序解法最优**：`buckets[freq].append(num)`，频次不会超过 n，所以开 n+1 个桶，从高频往低频扫取 K 个，O(n)。堆解法 `heapq.nlargest(k, cnt, key=cnt.get)` 是 O(n log k)，代码短，面试够用但说出桶排序会加分。",
cx:"桶排序 O(n)；堆 O(n log k)"},

{n:238, name:"除自身以外数组的乘积", slug:"product-of-array-except-self", lv:"中", must:true,
why:"不许用除法这个限制，逼你想出「前缀积 × 后缀积」这个思路。前缀和/积的思想在很多题里复用。",
hints:["每个位置的答案 = 它左边所有数的乘积 × 它右边所有数的乘积。","先从左往右扫一遍存前缀积，再从右往左扫一遍，边扫边乘后缀积。可以只用输出数组，不开额外空间。"],
key:"两次遍历。第一遍 `res[i]` 存 i 左边的乘积；第二遍用一个变量 `right` 从右往左累乘，`res[i] *= right`。空间 O(1)（不算输出）。",
cx:"时间 O(n)，空间 O(1)"},

{n:128, name:"最长连续序列", slug:"longest-consecutive-sequence", lv:"中",
why:"要求 O(n)，排序（O(n log n)）不达标。教你用 set 做 O(1) 查询，并且找到「只从序列起点开始数」这个剪枝。",
hints:["把所有数丢进 set，就能 O(1) 判断某个数存不存在。","关键剪枝：只有当 num-1 不在 set 里时，num 才是一个序列的起点，从它开始往上数。这样每个数最多被访问两次。"],
key:"`s = set(nums)`，遍历时只对「`num-1 not in s`」的起点向上计数。看似双层循环但总访问次数是 O(n)，因为每个数只在它所属序列被扫描一次。",
cx:"时间 O(n)，空间 O(n)"}
]},

{
key:"twop", name:"双指针", color:"#9ece6a",
pattern:`**核心思想：用两个指针代替两层循环。**

两种常见形态：
- **对撞指针**：左右各一个，向中间移动。用于**有序数组**、回文、盛水容器。
- **快慢指针**：同向移动但速度不同。用于原地移除元素、找链表中点、判环。

**识别信号**：数组**已排序**、要求**原地修改**、O(1) 空间、找一对/三个数。

**关键在于想清楚：什么条件下移动左指针，什么条件下移动右指针？** 这个判断必须保证「不会漏掉正确答案」。`,
problems:[
{n:125, name:"验证回文串", slug:"valid-palindrome", lv:"易",
why:"对撞指针最简单的形态，顺便考字符串处理的细节（忽略非字母数字、忽略大小写）。",
hints:["左右各一个指针，向中间靠拢，逐对比较。","遇到非字母数字的字符要跳过，比较时统一转小写。"],
key:"`l, r = 0, len(s)-1`，while l<r：跳过非 alnum 字符，比较 `s[l].lower() != s[r].lower()` 则返回 False，否则两指针内移。",
cx:"时间 O(n)，空间 O(1)"},

{n:167, name:"两数之和 II（输入有序）", slug:"two-sum-ii-input-array-is-sorted", lv:"中", must:true,
why:"和第 1 题对比着做，体会「有序」这个条件如何把空间从 O(n) 降到 O(1)。这个对比本身就是很好的面试谈资。",
hints:["数组有序，这个信息怎么利用？","左右指针：和太小就左指针右移（增大），和太大就右指针左移（减小）。"],
key:"对撞指针。`s = nums[l]+nums[r]`，`s < target` 则 `l++`，`s > target` 则 `r--`，相等即答案。**正确性来自有序性** —— 移动指针不会跳过任何可能的解。",
cx:"时间 O(n)，空间 O(1)"},

{n:15, name:"三数之和", slug:"3sum", lv:"中", must:true,
why:"高频中的高频。难点不在主逻辑，在**去重**。很多人写得出来但过不了重复用例。",
hints:["先排序。然后固定第一个数，剩下的就退化成「两数之和 II」。","去重有两处：外层固定的数如果和上一个相同就跳过；内层找到答案后，左右指针也要跳过重复值。"],
key:"排序后外层遍历 i（`if i>0 and nums[i]==nums[i-1]: continue` 去重），内层对 `[i+1, n-1]` 用对撞指针。找到答案后 `while l<r and nums[l]==nums[l+1]: l+=1` 跳重复。小优化：`nums[i]>0` 时可以直接 break。",
cx:"时间 O(n²)，空间 O(1)（不算排序）"},

{n:11, name:"盛最多水的容器", slug:"container-with-most-water", lv:"中", must:true,
why:"考的是「为什么移动短的那边是对的」这个贪心正确性证明。面试官很可能追问，要能说清楚。",
hints:["面积 = min(左高, 右高) × 宽度。从最宽的位置（两端）开始。","移动高的那边：宽度变小，高度受限于短板不会变大 → 面积必然变小。所以只能移动短的那边。"],
key:"对撞指针，每次移动**较矮**的那一侧。\n\n**正确性论证（面试要说出来）**：当前面积受短板限制。如果移动长板，宽度减小而高度上限不变（仍受短板限制），面积必然不增。所以移动长板不可能得到更优解，可以安全放弃。",
cx:"时间 O(n)，空间 O(1)"},

{n:42, name:"接雨水", slug:"trapping-rain-water", lv:"难",
why:"经典难题，有三种解法（DP 预处理 / 双指针 / 单调栈），能把三种都讲出来说明你理解透了。",
hints:["每个位置能接的水 = min(左边最高, 右边最高) - 当前高度。","方法一：预处理两个数组存左右最高。方法二：双指针，维护 left_max 和 right_max，哪边的 max 小就处理哪边。"],
key:"**双指针 O(1) 空间解法**：维护 `left_max` 和 `right_max`。若 `left_max < right_max`，则左边这个位置的水量已经能确定（受 left_max 限制），累加 `left_max - height[l]` 后 `l++`；反之处理右边。\n\n**核心洞察**：不需要知道右边具体最高是多少，只要知道 `right_max > left_max`，就能确定短板是左边。",
cx:"时间 O(n)，空间 O(1)"}
]},

{
key:"window", name:"滑动窗口", color:"#e0af68",
pattern:`**核心思想：维护一个区间，右边扩张、左边收缩。**

模板（背下来，能套 80% 的滑窗题）：
\`\`\`python
left = 0
for right in range(len(s)):
    加入 s[right] 到窗口

    while 窗口不满足条件:
        移出 s[left]
        left += 1

    更新答案
\`\`\`

**识别信号**：「连续子数组 / 子串」+「最长 / 最短 / 恰好满足某条件」。

**关键问题只有两个**：什么时候收缩左边界？答案在什么时候更新？想清楚这两个，代码自然就出来了。`,
problems:[
{n:3, name:"无重复字符的最长子串", slug:"longest-substring-without-repeating-characters", lv:"中", must:true,
why:"滑动窗口的标准入门题，几乎是面试出现频率最高的字符串题。",
hints:["用一个 set 或字典维护窗口内的字符。右指针每次吃进一个新字符。","如果新字符已经在窗口里，就不断从左边移出字符，直到重复消失。"],
key:"用 set 维护窗口。`while s[right] in window: window.remove(s[left]); left += 1`，然后加入新字符、更新最大长度。\n\n**优化版**：用字典记录字符最后出现的位置，left 可以直接跳到 `max(left, last[c]+1)`，省掉内层循环。",
cx:"时间 O(n)，空间 O(min(n, 字符集))"},

{n:424, name:"替换后的最长重复字符", slug:"longest-repeating-character-replacement", lv:"中",
why:"窗口条件不再是简单的「有无重复」，而是一个需要推导的表达式。这是滑窗题的典型进阶。",
hints:["窗口合法的条件是：窗口长度 - 窗口内出现最多的字符的次数 ≤ k。","维护窗口内的字符频次和 max_freq。不合法时收缩左边界。"],
key:"条件：`(right-left+1) - max_freq > k` 时收缩。\n\n**一个精妙点**：`max_freq` 不需要在收缩时重新计算（虽然它可能失效）。因为我们只关心**最大**窗口，`max_freq` 偏大只会让窗口不收缩，而答案只在窗口变大时更新，所以不影响正确性。这个细节面试官很喜欢追问。",
cx:"时间 O(n)，空间 O(26)"},

{n:76, name:"最小覆盖子串", slug:"minimum-window-substring", lv:"难", must:true,
why:"滑动窗口的天花板题。写对它说明你真正掌握了这个模式。大厂高频。",
hints:["需要两个计数器：目标字符串 t 的需求表，和当前窗口的实际表。再用一个变量记录「已经满足需求的字符种类数」。","右指针扩张直到覆盖所有需求，然后左指针尽量收缩，收缩过程中更新最小答案。"],
key:"`need = Counter(t)`，`have` 计数当前窗口，`valid` 记录已满足需求的字符**种类数**。\n\n右扩时若某字符数量恰好达到需求，`valid += 1`；当 `valid == len(need)` 时进入收缩循环，每次收缩前更新答案，移出字符若使数量低于需求则 `valid -= 1`。\n\n**易错点**：比较的是「种类数」而不是「总字符数」，且必须是「恰好等于」时才更新 valid，用 `>=` 会重复计数。",
cx:"时间 O(n+m)，空间 O(字符集)"},

{n:239, name:"滑动窗口最大值", slug:"sliding-window-maximum", lv:"难",
why:"引入单调队列这个数据结构。它在很多优化问题里出现，而且是 O(n) 求区间极值的标准工具。",
hints:["每次重新扫描窗口求最大值是 O(nk)，太慢。需要一个能 O(1) 拿到最大值、且支持两端进出的结构。","用双端队列存**下标**，保持队列中对应的值单调递减。新元素进来时，把队尾所有比它小的弹出（它们永远不可能成为最大值了）。"],
key:"单调递减双端队列存下标。三步：① 队首下标超出窗口范围则弹出；② 队尾元素值 ≤ 新元素则弹出（它们被新元素「挡住」了）；③ 新下标入队，队首即为当前窗口最大值。\n\n每个元素最多进出队列各一次，总体 O(n)。",
cx:"时间 O(n)，空间 O(k)"}
]},

{
key:"bs", name:"二分查找", color:"#bb9af7",
pattern:`**核心思想：每次排除一半的搜索空间。**

二分不只用于「在有序数组里找一个数」。更强大的用法是**二分答案**：当答案在一个范围内单调时（大了不行、小了可以），就可以二分这个答案。

**写对二分的关键是统一边界约定。** 推荐用左闭右闭 \`[l, r]\`：
\`\`\`python
l, r = 0, len(nums) - 1
while l <= r:                    # 注意是 <=
    mid = (l + r) // 2
    if nums[mid] == target: return mid
    elif nums[mid] < target: l = mid + 1
    else: r = mid - 1
return -1
\`\`\`

**识别信号**：有序、「最小的最大值」「最大的最小值」、数据范围极大（10⁹）暗示 log 复杂度。`,
problems:[
{n:704, name:"二分查找", slug:"binary-search", lv:"易", must:true,
why:"模板题。一定要能不假思索地写对边界，这是后面所有二分题的基础。",
hints:["注意三处细节：while 条件是 <= 还是 <，mid 怎么算，边界怎么更新。","用左闭右闭 [l, r] 约定：while l <= r，更新时 l = mid+1 或 r = mid-1。"],
key:"左闭右闭模板见上方。`mid = l + (r-l)//2` 可以防溢出（Python 不需要但 C++/Java 需要，面试提一句会加分）。",
cx:"时间 O(log n)，空间 O(1)"},

{n:33, name:"搜索旋转排序数组", slug:"search-in-rotated-sorted-array", lv:"中", must:true,
why:"考「在部分有序的数组上二分」。关键是判断哪一半是有序的，这个思维转换很有价值。",
hints:["数组被旋转后，从中点切开，必有一半是完全有序的。","先判断哪一半有序（比较 nums[l] 和 nums[mid]），再判断 target 是否落在那个有序区间内，决定往哪边走。"],
key:"若 `nums[l] <= nums[mid]`，左半有序：若 `nums[l] <= target < nums[mid]` 则往左，否则往右。反之右半有序，同理判断。\n\n**易错点**：比较要用 `<=`（处理 l==mid 的情况），且必须先确定哪半有序再判断 target 位置，顺序不能反。",
cx:"时间 O(log n)，空间 O(1)"},

{n:153, name:"寻找旋转排序数组中的最小值", slug:"find-minimum-in-rotated-sorted-array", lv:"中",
why:"二分找「拐点」而非找具体值。这类「找边界」的二分变体很常见。",
hints:["最小值就是旋转的拐点。比较 nums[mid] 和 nums[r] 能判断拐点在哪一侧。","如果 nums[mid] > nums[r]，说明拐点在 mid 右边（l = mid+1）；否则拐点在 mid 或其左边（r = mid）。"],
key:"用 `while l < r`（注意不是 <=）配合 `r = mid`（不是 mid-1），循环结束时 `l == r` 即答案。\n\n**为什么和 nums[r] 比而不是 nums[l]？** 因为和 nums[l] 比在完全有序的情况下会出错。这是个经典陷阱。",
cx:"时间 O(log n)，空间 O(1)"},

{n:875, name:"爱吃香蕉的珂珂", slug:"koko-eating-bananas", lv:"中", must:true,
why:"**二分答案**的代表题。这个模式在实际工程里用得很多（比如二分找最大可行 batch size）。",
hints:["答案（吃的速度 k）的范围是 1 到 max(piles)。速度越大用时越少 —— 这是单调的，可以二分。","写一个函数 check(k) 判断速度 k 能否在 h 小时内吃完，然后二分找最小的可行 k。"],
key:"二分答案模板：在 `[1, max(piles)]` 上二分速度 k，`check(k) = sum(ceil(p/k) for p in piles) <= h`。找**最小的**满足条件的 k。\n\n**识别二分答案的信号**：题目问「最小的最大值」或「最大的最小值」，且答案具有单调性（k 可行 → 所有比 k 大的都可行）。",
cx:"时间 O(n log(max))，空间 O(1)"}
]},

{
key:"stack", name:"栈", color:"#ff9e64",
pattern:`**核心思想：后进先出，用于「配对」和「找最近的某某」。**

两大用途：
- **括号匹配 / 表达式求值**：遇左括号压栈，遇右括号弹栈配对。
- **单调栈**：维护一个单调递增或递减的栈，用来求「下一个更大元素」「左边第一个更小元素」这类问题，把 O(n²) 降到 O(n)。

**单调栈识别信号**：题目问「下一个更大/更小的元素」「能看到几个」「柱状图面积」。`,
problems:[
{n:20, name:"有效的括号", slug:"valid-parentheses", lv:"易", must:true,
why:"栈的最基础应用，也是最常见的暖场题。要能一遍写对，不要在这种题上浪费面试时间。",
hints:["左括号压栈，右括号检查栈顶是否匹配。","用字典存配对关系。结束时栈必须为空（否则有未闭合的左括号）。"],
key:"`pairs = {')':'(', ']':'[', '}':'{'}`。遇左括号 push；遇右括号，若栈空或栈顶不匹配则 False，否则 pop。最后 `return not stack`。\n\n**两个易错点**：栈空时遇到右括号要返回 False；遍历完必须检查栈是否为空。",
cx:"时间 O(n)，空间 O(n)"},

{n:155, name:"最小栈", slug:"min-stack", lv:"中",
why:"考数据结构设计。要求所有操作 O(1)，逼你想出「辅助栈」这个技巧。",
hints:["getMin 要 O(1)，说明最小值必须是随时可查的，不能现算。","用第二个栈同步记录「到当前为止的最小值」。push 时压入 min(新值, 当前最小)。"],
key:"两个栈同步操作：主栈存值，辅助栈每次压入 `min(val, min_stack[-1])`。pop 时两个都弹。getMin 返回 `min_stack[-1]`。\n\n**优化版**（能说出来加分）：只在新值 ≤ 当前最小时才压辅助栈，pop 时若弹出值等于栈顶最小值才弹辅助栈，省空间。",
cx:"所有操作 O(1)"},

{n:739, name:"每日温度", slug:"daily-temperatures", lv:"中", must:true,
why:"单调栈的标准模板题。理解了这题，496、503、42 都能秒。",
hints:["对每个位置，要找右边第一个比它大的元素。暴力是 O(n²)。","维护一个单调递减栈（存下标）。新元素比栈顶大时，说明找到了栈顶元素的答案，弹出并记录距离。"],
key:"单调递减栈存**下标**。遍历时 `while stack and T[i] > T[stack[-1]]`：弹出栈顶 j，`res[j] = i - j`。然后 i 入栈。\n\n**为什么是 O(n)**：每个元素最多入栈一次、出栈一次。\n\n**模板意义**：「找右边第一个更大」用单调递减栈，「找右边第一个更小」用单调递增栈。",
cx:"时间 O(n)，空间 O(n)"},

{n:84, name:"柱状图中最大的矩形", slug:"largest-rectangle-in-histogram", lv:"难",
why:"单调栈的难题。核心是转换视角：枚举「以每根柱子为高」的最大矩形。",
hints:["对每根柱子，它能扩展的最大宽度 = 左边第一个更矮的位置 到 右边第一个更矮的位置 之间。","用单调递增栈，弹出时就能同时确定左右边界。首尾加哨兵 0 可以简化边界处理。"],
key:"单调**递增**栈。当 `heights[i] < 栈顶高度` 时弹出，弹出的柱子 h 的右边界是 i，左边界是弹出后的新栈顶+1，宽度 `i - stack[-1] - 1`。\n\n**技巧**：在数组首尾各加一个 0 作为哨兵，避免单独处理「栈非空的收尾」和「左边界越界」。",
cx:"时间 O(n)，空间 O(n)"}
]},

{
key:"list", name:"链表", color:"#f7768e",
pattern:`**核心思想：指针操作，注意不要断链。**

三个必备技巧：
- **虚拟头节点（dummy）**：\`dummy = ListNode(0); dummy.next = head\`。避免单独处理「删除头节点」这种边界。
- **快慢指针**：找中点（快走两步慢走一步）、判环、找倒数第 k 个。
- **画图**：链表题不画图容易写错。面试时在白板上画三个节点，一步步移指针。

**通用防错习惯**：每次改 \`next\` 之前，先想清楚有没有节点会因此丢失引用。需要的话先用临时变量存起来。`,
problems:[
{n:206, name:"反转链表", slug:"reverse-linked-list", lv:"易", must:true,
why:"链表第一题，必须能闭眼写。而且是很多题的子过程（如回文链表、K 个一组反转）。",
hints:["需要三个指针：prev、cur、next。","循环里四步：存下 next → cur.next 指向 prev → prev 移到 cur → cur 移到 next。顺序不能乱。"],
key:"```python\nprev = None\nwhile cur:\n    nxt = cur.next     # 先存，否则断链后找不到\n    cur.next = prev\n    prev = cur\n    cur = nxt\nreturn prev\n```\n**关键**：必须先保存 `cur.next`，因为下一行就会覆盖它。递归写法也要会，面试可能要求。",
cx:"时间 O(n)，空间 O(1)"},

{n:21, name:"合并两个有序链表", slug:"merge-two-sorted-lists", lv:"易", must:true,
why:"dummy 节点的经典用法。也是归并排序链表的子过程。",
hints:["用一个 dummy 头节点，避免判断「结果链表是否为空」。","比较两个链表当前节点，小的接到结果后面，对应指针后移。"],
key:"`dummy = ListNode()`，`tail = dummy`。循环比较接入，最后 `tail.next = l1 or l2` 接上剩余部分。返回 `dummy.next`。\n\n**dummy 的价值**：不用写「如果结果链表为空就把它当头节点，否则接到尾巴上」这种分支。",
cx:"时间 O(n+m)，空间 O(1)"},

{n:141, name:"环形链表", slug:"linked-list-cycle", lv:"易", must:true,
why:"Floyd 判圈算法（龟兔赛跑）。面试官常追问「为什么快慢指针一定会相遇」。",
hints:["快指针一次走两步，慢指针一次走一步。","如果有环，快指针会在环里追上慢指针 —— 因为每一轮它们的距离缩小 1。"],
key:"`slow = slow.next; fast = fast.next.next`，相遇则有环，fast 触底则无环。\n\n**为什么必定相遇**：进环后，快指针相对慢指针每轮靠近 1 步，距离必然递减到 0，不会「跳过」。\n\n**进阶（142 题）**：相遇后把一个指针放回头部，两者同速前进，再次相遇处即为环的入口。这个结论可以用数学推导，面试能推出来很加分。",
cx:"时间 O(n)，空间 O(1)"},

{n:143, name:"重排链表", slug:"reorder-list", lv:"中",
why:"三个基本操作的组合题：找中点 + 反转后半 + 交替合并。考的是把大问题拆成已知子问题的能力。",
hints:["目标顺序是 L0→Ln→L1→Ln-1→…，相当于把后半部分反转后和前半交替合并。","三步走：快慢指针找中点 → 反转后半段 → 两段交替穿插。"],
key:"分三步，每步都是前面做过的题：① 快慢指针找中点并断开；② 反转后半（206 题）；③ 交替合并两条链。\n\n**这题的价值在于「拆解」** —— 面试时明确说出「我把它分成三个子问题」会让面试官觉得你思路清晰。",
cx:"时间 O(n)，空间 O(1)"},

{n:23, name:"合并 K 个升序链表", slug:"merge-k-sorted-lists", lv:"难",
why:"考复杂度分析。有多种解法，能对比出优劣说明你有分析能力。",
hints:["方法一：用最小堆，每次取出 k 个头节点里最小的。O(N log k)。","方法二：分治两两合并，类似归并排序。同样 O(N log k) 但空间更省。注意：顺序两两合并是 O(Nk)，会超时。"],
key:"**分治合并**最优：两两配对合并，递归 log k 层，每层处理 N 个节点，总 O(N log k)。\n\n**堆解法**：`heapq` 维护 k 个头节点，每次弹最小并推入它的 next。注意 Python 的 heapq 不能直接比较 ListNode，要压入 `(val, idx, node)` 元组。\n\n**面试要点**：主动指出朴素的「依次合并」是 O(Nk)，然后给出 O(N log k) 的改进 —— 这个对比本身就是得分点。",
cx:"时间 O(N log k)，空间 O(log k)"}
]},

{
key:"tree", name:"二叉树", color:"#2ac3de",
pattern:`**核心思想：递归。树的定义本身就是递归的。**

写树的递归题只问三个问题：
1. **这个函数返回什么？**（定义清楚语义）
2. **递归终止条件是什么？**（通常是 \`if not root: return ...\`）
3. **如何用子问题的结果拼出当前答案？**

想清楚这三点，代码通常只有 3-5 行。

**两种遍历方式**：
- **DFS（递归）**：前序（根左右）、中序（左根右，BST 中序是有序的）、后序（左右根，适合自底向上收集信息）
- **BFS（队列）**：层序遍历，适合「层」相关的问题和最短路径`,
problems:[
{n:104, name:"二叉树的最大深度", slug:"maximum-depth-of-binary-tree", lv:"易", must:true,
why:"递归三问的最小示范。三行代码，但思维方式适用于一大类题。",
hints:["一棵树的深度 = 1 + 左右子树深度的较大值。","终止条件：空节点深度为 0。"],
key:"`return 0 if not root else 1 + max(depth(root.left), depth(root.right))`\n\n**这就是「递归三问」的模板**：返回子树深度 / 空树返回 0 / 当前 = 1 + max(子问题)。后面所有树的题都是这个思路的变体。",
cx:"时间 O(n)，空间 O(h) h 为树高"},

{n:226, name:"翻转二叉树", slug:"invert-binary-tree", lv:"易",
why:"著名的「Homebrew 作者没写出来被 Google 拒了」那道题。三行代码，必须秒杀。",
hints:["交换左右子树，然后递归处理两边。","一行搞定：root.left, root.right = invert(root.right), invert(root.left)"],
key:"```python\nif not root: return None\nroot.left, root.right = invert(root.right), invert(root.left)\nreturn root\n```\nPython 的元组赋值天然避免了需要临时变量的问题。",
cx:"时间 O(n)，空间 O(h)"},

{n:102, name:"二叉树的层序遍历", slug:"binary-tree-level-order-traversal", lv:"中", must:true,
why:"BFS 模板题。所有「按层」的问题（右视图、最大层和、之字形）都是它的变体。",
hints:["用队列。但要分层输出，需要知道每层有几个节点。","进入循环时先记录 len(queue)，这就是当前层的节点数，只处理这么多个。"],
key:"```python\nq = deque([root])\nwhile q:\n    size = len(q)          # 关键：先固定当前层大小\n    level = []\n    for _ in range(size):\n        node = q.popleft()\n        level.append(node.val)\n        if node.left:  q.append(node.left)\n        if node.right: q.append(node.right)\n    res.append(level)\n```\n**`size = len(q)` 这一行是分层的关键**，没有它就只能得到一个扁平序列。",
cx:"时间 O(n)，空间 O(n)"},

{n:98, name:"验证二叉搜索树", slug:"validate-binary-search-tree", lv:"中", must:true,
why:"经典陷阱题。只比较父子节点是错的，必须传递上下界。这个坑很多人第一次都会踩。",
hints:["只检查 root.left.val < root.val 是不够的 —— 左子树里的某个深层节点可能大于 root。","递归时传下界和上界：进入左子树时上界变成当前值，进入右子树时下界变成当前值。"],
key:"```python\ndef valid(node, low, high):\n    if not node: return True\n    if not (low < node.val < high): return False\n    return valid(node.left, low, node.val) and \\\n           valid(node.right, node.val, high)\n```\n初始调用 `valid(root, -inf, inf)`。\n\n**另一种解法**：中序遍历 BST 应该得到严格递增序列，边遍历边检查是否大于前一个值。",
cx:"时间 O(n)，空间 O(h)"},

{n:236, name:"二叉树的最近公共祖先", slug:"lowest-common-ancestor-of-a-binary-tree", lv:"中", must:true,
why:"后序遍历「自底向上传信息」的经典。代码短但思维密度高，大厂高频。",
hints:["递归函数的语义定义为：在以 root 为根的树中，如果找到 p 或 q 就返回它，找到 LCA 就返回 LCA，都没有返回 None。","左右子树各递归一次。如果两边都返回非空，说明 p 和 q 分别在两侧，当前节点就是 LCA。"],
key:"```python\nif not root or root == p or root == q: return root\nL = lca(root.left, p, q)\nR = lca(root.right, p, q)\nif L and R: return root      # 分居两侧，当前即 LCA\nreturn L or R                # 否则返回非空的那一边\n```\n**精髓在于函数语义的定义** —— 定义对了，代码自然就出来了。这题充分体现「递归三问」里第一问的重要性。",
cx:"时间 O(n)，空间 O(h)"},

{n:105, name:"从前序与中序遍历序列构造二叉树", slug:"construct-binary-tree-from-preorder-and-inorder-traversal", lv:"中",
why:"考对遍历性质的理解。前序第一个是根，中序里根的位置分开左右子树 —— 这个洞察是关键。",
hints:["前序的第一个元素一定是根节点。在中序里找到它，左边是左子树，右边是右子树。","用哈希表存中序的「值→下标」，避免每次线性查找。递归时传递区间边界而不是切片（切片会导致 O(n²)）。"],
key:"前序 `[根 | 左子树 | 右子树]`，中序 `[左子树 | 根 | 右子树]`。在中序里定位根，得到左子树大小 k，则前序的 `[1, k]` 是左子树、`[k+1, ...]` 是右子树。\n\n**优化**：哈希表预存中序下标（O(1) 定位），递归传下标区间而非数组切片，总复杂度 O(n)。",
cx:"时间 O(n)，空间 O(n)"}
]},

{
key:"graph", name:"图 / BFS / DFS", color:"#c0caf5",
pattern:`**核心思想：遍历 + 标记已访问。**

图题的两个基本工具：
- **DFS**：递归或栈，适合「连通块」「路径」「是否存在」
- **BFS**：队列，适合「最短路径」（无权图）、「层数」

**网格题（岛屿类）的模板**：把二维网格当图，每个格子四个方向的邻居。
\`\`\`python
def dfs(r, c):
    if 越界 or 已访问 or 不符合条件: return
    标记已访问
    for dr, dc in [(0,1),(0,-1),(1,0),(-1,0)]:
        dfs(r+dr, c+dc)
\`\`\`

**永远不要忘记标记已访问**，否则无限递归。`,
problems:[
{n:200, name:"岛屿数量", slug:"number-of-islands", lv:"中", must:true,
why:"网格 DFS/BFS 的模板题。所有岛屿类题（695 面积、130 包围区域、994 腐烂橘子）都是它的变体。",
hints:["遍历每个格子，遇到没访问过的陆地就计数 +1，然后用 DFS 把整块陆地都标记掉。","标记方式可以直接把 '1' 改成 '0'（原地修改，省空间），也可以用 visited 集合。"],
key:"双层循环扫网格，遇到 `'1'` 则 `count += 1` 并启动 DFS 把相连的陆地全部沉没（改为 `'0'`）。\n\n**为什么这样是对的**：每次 DFS 会吃掉一整个连通块，所以启动 DFS 的次数 = 连通块数量。\n\n注意 DFS 深度可能到 m×n，极端情况会栈溢出，面试可以提一句「用 BFS 或显式栈更安全」。",
cx:"时间 O(m·n)，空间 O(m·n)"},

{n:133, name:"克隆图", slug:"clone-graph", lv:"中",
why:"考「边遍历边建映射」处理环的能力。深拷贝带环结构是实际工程里也会遇到的问题。",
hints:["图里有环，直接递归会无限循环。需要记录「原节点 → 新节点」的映射。","递归前先把当前节点的克隆存进映射表，再递归邻居 —— 顺序很重要。"],
key:"用字典 `old_to_new` 做映射。DFS 时**先创建克隆并存入字典，再递归处理邻居**。如果节点已在字典中直接返回，这样天然处理了环。\n\n**顺序是关键**：如果先递归再存字典，环会导致无限递归。",
cx:"时间 O(V+E)，空间 O(V)"},

{n:207, name:"课程表（拓扑排序）", slug:"course-schedule", lv:"中", must:true,
why:"拓扑排序 + 环检测。在依赖解析、任务调度、编译顺序里都有实际应用。",
hints:["这是在问有向图里有没有环。有环就不可能完成所有课程。","方法一：Kahn 算法（BFS）—— 不断取出入度为 0 的节点。如果最后处理的节点数少于总数，说明有环。"],
key:"**Kahn 算法（推荐，不会栈溢出）**：建邻接表 + 统计入度 → 入度为 0 的入队 → 每弹出一个节点，把它的后继入度减 1，减到 0 就入队 → 最后比较处理过的节点数和总数。\n\n**DFS 解法**：三色标记（未访问/访问中/已完成），遇到「访问中」的节点说明有环。\n\n210 题要求输出具体顺序，Kahn 的出队顺序就是答案。",
cx:"时间 O(V+E)，空间 O(V+E)"},

{n:994, name:"腐烂的橘子", slug:"rotting-oranges", lv:"中",
why:"**多源 BFS**。BFS 天然按层扩散，正好对应「每分钟腐烂一圈」的语义。这个模式很实用。",
hints:["不是从一个点出发，而是所有腐烂的橘子同时开始扩散 —— 把它们全部作为 BFS 的初始层。","BFS 的层数就是经过的分钟数。最后检查还有没有新鲜橘子剩下。"],
key:"**多源 BFS**：初始把所有腐烂橘子入队，同时统计新鲜橘子数。每轮处理一整层（分钟 +1），把感染到的新鲜橘子标记并入队、计数减 1。\n\n结束后若新鲜数 > 0 返回 -1，否则返回分钟数。\n\n**注意边界**：初始就没有新鲜橘子时应返回 0，别多算一分钟。",
cx:"时间 O(m·n)，空间 O(m·n)"}
]},

{
key:"dp", name:"动态规划", color:"#bb9af7",
pattern:`**核心思想：把大问题拆成有重叠的子问题，把答案存下来避免重复计算。**

写 DP 只需要回答四个问题：
1. **dp[i] 表示什么？**（状态定义 —— 这是最难也最关键的一步）
2. **状态转移方程是什么？**（dp[i] 怎么由前面的状态算出来）
3. **初始值是什么？**
4. **遍历顺序是什么？**（保证用到的状态已经算好了）

**新手建议**：先写出朴素递归（自顶向下），加上记忆化，再改成迭代（自底向上）。这条路比直接想递推式容易得多。

**识别信号**：求「最值」「方案数」「能否达成」，且当前决策依赖之前的状态。`,
problems:[
{n:70, name:"爬楼梯", slug:"climbing-stairs", lv:"易", must:true,
why:"DP 的 Hello World。看清楚它其实就是斐波那契，建立「当前状态由前几个状态推出」的直觉。",
hints:["到第 n 阶，只能从 n-1 阶迈一步或 n-2 阶迈两步上来。","dp[n] = dp[n-1] + dp[n-2]，初始 dp[1]=1, dp[2]=2。"],
key:"`dp[i] = dp[i-1] + dp[i-2]`，就是斐波那契数列。\n\n**空间优化**：只需要前两个值，用两个变量滚动即可，空间 O(1)。这个「滚动数组」技巧在很多 DP 题里能用。",
cx:"时间 O(n)，空间 O(1)"},

{n:198, name:"打家劫舍", slug:"house-robber", lv:"中", must:true,
why:"「选或不选」这个最基本的 DP 决策模型。后面的背包问题都是它的推广。",
hints:["对每间房子只有两个选择：偷或不偷。偷了就不能偷相邻的。","dp[i] = max(不偷第 i 间 = dp[i-1], 偷第 i 间 = dp[i-2] + nums[i])"],
key:"`dp[i] = max(dp[i-1], dp[i-2] + nums[i])`\n\n**这就是「选 or 不选」的标准形式**，是 01 背包的一维简化版。\n\n213 题（环形）的处理方法：分别算「不偷第一间」和「不偷最后一间」两种情况取最大值。",
cx:"时间 O(n)，空间 O(1)"},

{n:322, name:"零钱兑换", slug:"coin-change", lv:"中", must:true,
why:"完全背包的模板题。也是最能体现「DP 状态定义」重要性的题之一。",
hints:["dp[i] 定义为：凑出金额 i 所需的最少硬币数。","对每个金额 i，尝试用每一种硬币 c：dp[i] = min(dp[i], dp[i-c] + 1)。初始 dp[0]=0，其余设为无穷大。"],
key:"```python\ndp = [inf] * (amount+1)\ndp[0] = 0\nfor i in range(1, amount+1):\n    for c in coins:\n        if c <= i:\n            dp[i] = min(dp[i], dp[i-c] + 1)\nreturn dp[amount] if dp[amount] != inf else -1\n```\n**注意**：贪心（每次拿最大面额）是**错的**。比如 coins=[1,3,4], amount=6，贪心给 4+1+1=3 枚，最优是 3+3=2 枚。面试时主动指出贪心不成立会加分。",
cx:"时间 O(amount × len(coins))，空间 O(amount)"},

{n:300, name:"最长递增子序列", slug:"longest-increasing-subsequence", lv:"中", must:true,
why:"有 O(n²) 和 O(n log n) 两种解法。能讲出二分优化那版会明显加分。",
hints:["O(n²) 解法：dp[i] 表示以 nums[i] 结尾的最长递增子序列长度，对每个 i 回看所有 j<i。","O(n log n) 解法：维护一个数组 tails，tails[k] 存长度为 k+1 的递增子序列的最小末尾值。用二分找插入位置。"],
key:"**O(n²)**：`dp[i] = max(dp[j]+1 for j<i if nums[j]<nums[i])`\n\n**O(n log n)**：维护 `tails` 数组（严格递增），对每个数二分找第一个 ≥ 它的位置替换，找不到就追加。最终 `len(tails)` 即答案。\n\n**重要提醒**：`tails` 本身**不是**某个真实的递增子序列，它只是用来记录各长度的最小可能末尾。这个细节面试官爱问。",
cx:"O(n²) 或 O(n log n)"},

{n:139, name:"单词拆分", slug:"word-break", lv:"中",
why:"字符串上的 DP，状态定义是布尔值。培养「把字符串问题转成 DP」的感觉。",
hints:["dp[i] 表示前 i 个字符能否被拆分成字典里的词。","对每个 i，枚举分割点 j：如果 dp[j] 为真且 s[j:i] 在字典里，则 dp[i] 为真。"],
key:"`dp[i] = any(dp[j] and s[j:i] in wordSet for j in range(i))`，初始 `dp[0]=True`。\n\n**优化**：把 wordDict 转成 set 做 O(1) 查询；内层 j 的范围可以限制在 `i - max_word_len` 到 `i`，避免无用的切片。",
cx:"时间 O(n² × k)，空间 O(n)"},

{n:1143, name:"最长公共子序列", slug:"longest-common-subsequence", lv:"中", must:true,
why:"二维 DP 的代表。编辑距离（72）、最长公共子串都是同一个框架，学会一个通吃一片。",
hints:["dp[i][j] 表示 text1 前 i 个字符和 text2 前 j 个字符的 LCS 长度。","如果 text1[i-1] == text2[j-1]，dp[i][j] = dp[i-1][j-1] + 1；否则 dp[i][j] = max(dp[i-1][j], dp[i][j-1])。"],
key:"经典二维 DP：\n```python\nif a[i-1] == b[j-1]:\n    dp[i][j] = dp[i-1][j-1] + 1\nelse:\n    dp[i][j] = max(dp[i-1][j], dp[i][j-1])\n```\n**下标技巧**：dp 数组开 `(m+1) × (n+1)`，第 0 行 0 列表示空串，这样不用单独处理边界。\n\n**编辑距离（72 题）** 是同一个框架，只是转移方程变成三选一取最小（插入/删除/替换）。这两题一起做效率最高。",
cx:"时间 O(m·n)，空间 O(m·n)，可优化到 O(min(m,n))"}
]},

{
key:"mlcode", name:"ML 岗特有的手撕题", color:"#9ece6a",
pattern:`**这一组不是 LeetCode 题，但在算法岗面试里出现频率极高。**

面试官经常在写完一道标准算法题后加一句「那你再写一下 softmax 吧」。这些题不难，但**没准备过会当场卡住**，而且卡在这种题上给人的印象特别差 —— 因为它们都是你天天在用的东西。

每道题都要注意**数值稳定性**和**向量化**，这两点正是面试官想考的。用 for 循环写 softmax 会被扣分。`,
problems:[
{n:0, name:"数值稳定的 Softmax", slug:"ml-softmax", lv:"中", must:true,
why:"最高频的 ML 手撕题。考点不是公式，而是**你知不知道要减去最大值防溢出**。",
hints:["公式是 exp(xi) / sum(exp(xj))。但如果 x 里有 1000 这种大数，exp(1000) 会直接溢出成 inf。","利用 softmax 的平移不变性：分子分母同时除以 exp(max)，等价于先把每个 x 减去 max。结果不变但不会溢出。"],
key:"```python\ndef softmax(x, axis=-1):\n    x = x - np.max(x, axis=axis, keepdims=True)   # 关键一行\n    e = np.exp(x)\n    return e / np.sum(e, axis=axis, keepdims=True)\n```\n**必须说出来的两点**：\n1. 减最大值是因为 softmax 有**平移不变性**，`softmax(x) = softmax(x-c)`，减完最大值后指数最大为 e⁰=1，绝不溢出。\n2. `keepdims=True` 保证广播正确，忘了会报形状错误。\n\n追问：log_softmax 为什么要单独实现？因为 `log(softmax(x))` 会先算出极小的概率再取 log，损失精度；直接推导成 `x - max - log(sum(exp(x-max)))` 更稳。",
cx:"时间 O(n)，空间 O(n)"},

{n:0, name:"手写 Self-Attention", slug:"ml-attention", lv:"中", must:true,
why:"LLM 岗的标志性手撕题。写不出来基本就结束了。",
hints:["三步：QK^T 算分数 → 除以 sqrt(d_k) → softmax → 乘 V。","注意因果掩码：用下三角矩阵，把上三角位置填 -inf（在 softmax 之前填，不是之后置零）。"],
key:"```python\ndef attention(Q, K, V, mask=None):\n    d_k = Q.shape[-1]\n    scores = Q @ K.transpose(-2,-1) / math.sqrt(d_k)\n    if mask is not None:\n        scores = scores.masked_fill(mask==0, float('-inf'))\n    w = scores.softmax(-1)\n    return w @ V\n```\n**高频追问**：\n- 为什么除 √d_k？（方差推导，见概率课）\n- 为什么 mask 填 -inf 而不是 0？（因为要在 softmax **之前**屏蔽，-inf 经过 exp 变成 0；softmax 之后置零会破坏归一化）\n- 多头怎么改？（reshape 成 (B,h,T,dk)，算完 transpose 回来 + contiguous）",
cx:"时间 O(T²·d)，空间 O(T²)"},

{n:0, name:"K-means 聚类", slug:"ml-kmeans", lv:"中",
why:"考基础 ML 的实现能力，以及你对收敛条件、初始化的理解。",
hints:["两步交替：① 把每个点分配给最近的中心 ② 用每个簇的均值更新中心。重复直到中心不再移动。","距离计算要向量化：用广播算出 (n_samples, k) 的距离矩阵，然后 argmin。"],
key:"```python\ndef kmeans(X, k, iters=100):\n    centers = X[np.random.choice(len(X), k, replace=False)]\n    for _ in range(iters):\n        d = ((X[:,None,:] - centers[None,:,:])**2).sum(-1)  # (n,k)\n        labels = d.argmin(1)\n        new = np.array([X[labels==i].mean(0) for i in range(k)])\n        if np.allclose(new, centers): break\n        centers = new\n    return labels, centers\n```\n**要主动提到的点**：随机初始化可能收敛到差的局部最优，实践用 **k-means++**（按距离平方概率选初始中心）；空簇要处理；K 的选择用轮廓系数。",
cx:"时间 O(iters·n·k·d)"},

{n:0, name:"计算 IoU（交并比）", slug:"ml-iou", lv:"易",
why:"CV 岗必考，NLP 岗也可能问（用于区间重叠判断）。简单但边界容易写错。",
hints:["交集的左上角取两个框左上角的较大值，右下角取较小值。","如果交集的宽或高是负数，说明没有重叠，面积应该是 0 —— 记得用 max(0, ...) 截断。"],
key:"```python\ndef iou(a, b):   # box = [x1,y1,x2,y2]\n    x1, y1 = max(a[0],b[0]), max(a[1],b[1])\n    x2, y2 = min(a[2],b[2]), min(a[3],b[3])\n    inter = max(0, x2-x1) * max(0, y2-y1)   # 关键：截断负数\n    area_a = (a[2]-a[0]) * (a[3]-a[1])\n    area_b = (b[2]-b[0]) * (b[3]-b[1])\n    return inter / (area_a + area_b - inter)\n```\n**易错点**：忘了 `max(0, ...)` 会在不相交时算出正的假面积（负×负）；分母要减去 inter 避免重复计。",
cx:"O(1)"},

{n:0, name:"从零实现逻辑回归（含梯度下降）", slug:"ml-logreg", lv:"中",
why:"考你是否真的理解「前向-损失-梯度-更新」这个循环，而不只是会调 sklearn。",
hints:["前向：z = Xw + b，p = sigmoid(z)。损失：交叉熵。","梯度有个漂亮的形式：dL/dw = X^T(p - y) / n，dL/db = mean(p - y)。可以自己推导验证。"],
key:"```python\nfor _ in range(epochs):\n    z = X @ w + b\n    p = 1 / (1 + np.exp(-z))\n    grad_w = X.T @ (p - y) / len(y)\n    grad_b = (p - y).mean()\n    w -= lr * grad_w\n    b -= lr * grad_b\n```\n**加分点**：\n- 指出梯度形式 `X^T(p-y)` 和线性回归一模一样 —— 这不是巧合，而是广义线性模型的共性。\n- sigmoid 要做数值稳定处理（z 很负时 `exp(-z)` 会溢出）。\n- 加 L2 正则就是在 grad_w 上加 `lambda * w`。",
cx:"时间 O(epochs·n·d)"},

{n:0, name:"Top-K 采样 / 核采样（Top-p）", slug:"ml-sampling", lv:"中",
why:"LLM 岗专属。天天在用的解码参数，但很多人没自己实现过。",
hints:["Top-k：保留概率最高的 k 个，其余置为 -inf，重新 softmax 后采样。","Top-p：按概率降序累加，保留累积和刚超过 p 的那些。注意至少要保留一个 token。"],
key:"```python\ndef sample(logits, temp=1.0, top_p=0.9):\n    if temp == 0: return logits.argmax(-1)\n    probs = (logits / temp).softmax(-1)\n    sp, si = probs.sort(descending=True)\n    cum = sp.cumsum(-1)\n    sp[cum - sp > top_p] = 0      # 保证至少留一个\n    sp /= sp.sum()\n    return si.gather(-1, torch.multinomial(sp, 1))\n```\n**三个易错点**：① `cum - sp > top_p` 而不是 `cum > top_p`，否则最高概率词若已超过 p 会被全部滤掉；② 过滤后必须重新归一化；③ temp=0 要单独处理避免除零。",
cx:"时间 O(V log V)"}
]}
];
