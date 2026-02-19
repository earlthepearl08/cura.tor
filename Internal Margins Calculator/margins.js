document.addEventListener('DOMContentLoaded', () => {

    // ==================== CONSTANTS ====================

    const DEFAULT_PROJECT_TYPES = [
        { id: 'residential', label: 'Residential (up to 20kWp)', category: 'solar', builtIn: true,
          ratePerKwp: 45000, marginThresholds: { target: { min: 30, max: 40 }, warning: 25, critical: 18 } },
        { id: 'ci_small', label: 'C&I Small (21-100kWp)', category: 'solar', builtIn: true,
          ratePerKwp: 42000, marginThresholds: { target: { min: 25, max: 35 }, warning: 20, critical: 15 } },
        { id: 'ci_large', label: 'C&I Large (100-300kWp)', category: 'solar', builtIn: true,
          ratePerKwp: 38500, marginThresholds: { target: { min: 20, max: 28 }, warning: 15, critical: 10 } },
        { id: 'utility', label: 'Utility Scale (300kWp+)', category: 'solar', builtIn: true,
          ratePerKwp: 35000, marginThresholds: { target: { min: 15, max: 22 }, warning: 12, critical: 8 } }
    ];

    function getProjectType(typeId) {
        return state.projectTypes.find(t => t.id === typeId) || null;
    }

    function isSolarType(typeId) {
        const pType = getProjectType(typeId);
        return pType !== null && pType.category === 'solar';
    }

    function isPercentageMode(project) {
        return project.projectedCostMode === 'percentage';
    }

    const COST_CATEGORIES = [
        { key: 'equipment',  label: 'Equipment / COGS',        sublabel: 'Materials, supplies, hardware, components' },
        { key: 'labor',      label: 'Labor & Installation',    sublabel: 'Crew, subcontractors, project management' },
        { key: 'permitting', label: 'Permitting & Compliance', sublabel: 'Permits, inspections, regulatory fees' },
        { key: 'logistics',  label: 'Logistics & Delivery',    sublabel: 'Shipping, transport, equipment rental' },
        { key: 'sales',      label: 'Sales & Marketing',       sublabel: 'Commissions, site visits, proposals' },
        { key: 'overhead',   label: 'Overhead Allocation',     sublabel: 'Office, admin, insurance, utilities' },
        { key: 'warranty',   label: 'Warranty Reserves',       sublabel: 'Service agreements, contingency reserves' }
    ];

    const STORAGE_KEY = 'kinmo_margins_data';
    const STORAGE_VERSION = 2;

    // ==================== STATE ====================

    let state = {
        projects: [],
        projectTypes: [...DEFAULT_PROJECT_TYPES],
        activeProjectId: null,
        filters: {
            search: '',
            scale: 'all',
            status: 'all'
        }
    };

    let lastMarginValues = { revenue: 0, totalCost: 0, grossMarginPct: 0, grossProfit: 0 };

    // ==================== DOM ELEMENTS ====================

    const el = {
        // Sidebar
        mobileToggle: document.getElementById('mobileToggle'),
        sidebarOverlay: document.getElementById('sidebarOverlay'),
        sidebar: document.querySelector('.sidebar'),
        btnNewProject: document.getElementById('btnNewProject'),
        projectSearch: document.getElementById('projectSearch'),
        filterScale: document.getElementById('filterScale'),
        customTypesList: document.getElementById('customTypesList'),
        filterStatus: document.getElementById('filterStatus'),
        projectList: document.getElementById('projectList'),
        btnExportAll: document.getElementById('btnExportAll'),
        btnClearData: document.getElementById('btnClearData'),

        // Main content
        displayScale: document.getElementById('displayScale'),
        displayStatus: document.getElementById('displayStatus'),
        emptyState: document.getElementById('emptyState'),
        projectDetail: document.getElementById('projectDetail'),

        // Project info
        infoCustomer: document.getElementById('infoCustomer'),
        infoScale: document.getElementById('infoScale'),
        infoSize: document.getElementById('infoSize'),
        infoDate: document.getElementById('infoDate'),

        // Margin metrics
        metricRevenue: document.getElementById('metricRevenue'),
        metricTotalCost: document.getElementById('metricTotalCost'),
        metricGrossMargin: document.getElementById('metricGrossMargin'),
        metricGrossProfit: document.getElementById('metricGrossProfit'),
        marginIndicator: document.getElementById('marginIndicator'),
        marginWarning: document.getElementById('marginWarning'),
        cardGrossMargin: document.getElementById('cardGrossMargin'),

        // Cost forms
        projectedCostsForm: document.getElementById('projectedCostsForm'),
        actualCostsSection: document.getElementById('actualCostsSection'),
        actualCostsForm: document.getElementById('actualCostsForm'),

        // Comparison
        comparisonSection: document.getElementById('comparisonSection'),
        comparisonTable: document.getElementById('comparisonTable'),
        metricActualMargin: document.getElementById('metricActualMargin'),
        metricVariance: document.getElementById('metricVariance'),

        // Actions
        btnMarkComplete: document.getElementById('btnMarkComplete'),
        btnExportProject: document.getElementById('btnExportProject'),
        btnDeleteProject: document.getElementById('btnDeleteProject'),

        // New project modal
        newProjectModal: document.getElementById('newProjectModal'),
        modalCloseNew: document.getElementById('modalCloseNew'),
        newProjectForm: document.getElementById('newProjectForm'),
        newCustomerName: document.getElementById('newCustomerName'),
        newProjectName: document.getElementById('newProjectName'),
        newProjectScale: document.getElementById('newProjectScale'),
        newSystemSize: document.getElementById('newSystemSize'),
        newRevenue: document.getElementById('newRevenue'),
        newCostMode: document.getElementById('newCostMode'),
        newBaseCost: document.getElementById('newBaseCost'),
        baseCostGroup: document.getElementById('baseCostGroup'),
        newNotes: document.getElementById('newNotes'),

        // Custom type inline form
        customTypeForm: document.getElementById('customTypeForm'),
        customTypeName: document.getElementById('customTypeName'),
        thresholdTarget: document.getElementById('thresholdTarget'),
        thresholdWarning: document.getElementById('thresholdWarning'),
        thresholdCritical: document.getElementById('thresholdCritical'),
        btnCreateType: document.getElementById('btnCreateType'),
        btnCancelType: document.getElementById('btnCancelType'),

        // Revert modal
        revertModal: document.getElementById('revertModal'),
        btnCancelRevert: document.getElementById('btnCancelRevert'),
        btnConfirmRevert: document.getElementById('btnConfirmRevert'),
        btnRevertProject: document.getElementById('btnRevertProject'),

        // Delete modal
        deleteModal: document.getElementById('deleteModal'),
        btnCancelDelete: document.getElementById('btnCancelDelete'),
        btnConfirmDelete: document.getElementById('btnConfirmDelete'),

        // Mark complete modal
        completeModal: document.getElementById('completeModal'),
        btnCancelComplete: document.getElementById('btnCancelComplete'),
        btnConfirmComplete: document.getElementById('btnConfirmComplete'),

        // Clear all modal
        clearAllModal: document.getElementById('clearAllModal'),
        btnCancelClearAll: document.getElementById('btnCancelClearAll'),
        btnConfirmClearAll: document.getElementById('btnConfirmClearAll'),

        // Form errors
        formErrors: document.getElementById('formErrors')
    };

    // ==================== UTILITIES ====================

    function formatPHP(val) {
        const abs = Math.abs(val);
        return (val < 0 ? '-' : '') + '\u20B1 ' + abs.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    const activeAnimations = new Map();

    function animateValue(element, start, end, duration = 800, suffix = '') {
        if (!element) return;
        // Cancel any running animation on this element
        if (activeAnimations.has(element)) {
            cancelAnimationFrame(activeAnimations.get(element));
        }
        // Skip animation if value hasn't changed
        if (start === end) {
            if (suffix === '%') {
                element.textContent = end.toFixed(1) + '%';
            } else {
                element.textContent = formatPHP(end);
            }
            return;
        }
        const startTime = performance.now();
        const range = end - start;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = start + (range * easeOutQuart);

            if (suffix === '%') {
                element.textContent = current.toFixed(1) + '%';
            } else {
                element.textContent = formatPHP(current);
            }
            element.classList.add('updating');

            if (progress < 1) {
                const frameId = requestAnimationFrame(update);
                activeAnimations.set(element, frameId);
            } else {
                activeAnimations.delete(element);
                setTimeout(() => element.classList.remove('updating'), 300);
            }
        }
        const frameId = requestAnimationFrame(update);
        activeAnimations.set(element, frameId);
    }

    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function generateId() {
        return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function formatDate(isoString) {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // ==================== PERSISTENCE ====================

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                state.projectTypes = [...DEFAULT_PROJECT_TYPES];
                return;
            }
            const data = JSON.parse(raw);
            if (data.version === 2) {
                state.projects = data.projects || [];
                state.projectTypes = data.projectTypes || [...DEFAULT_PROJECT_TYPES];
            } else if (data.version === 1) {
                // Migration v1 → v2: existing project scale values match built-in type IDs
                state.projects = data.projects || [];
                state.projectTypes = [...DEFAULT_PROJECT_TYPES];
                saveState();
            }
        } catch (e) {
            console.error('Failed to load state:', e);
            state.projectTypes = [...DEFAULT_PROJECT_TYPES];
        }
    }

    function saveState() {
        try {
            const data = {
                version: STORAGE_VERSION,
                lastModified: new Date().toISOString(),
                projects: state.projects,
                projectTypes: state.projectTypes
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    // ==================== CALCULATION ENGINE ====================

    function calculateMargin(costs, revenue) {
        const totalCost = Object.values(costs).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        const rev = parseFloat(revenue) || 0;
        const grossProfit = rev - totalCost;
        const grossMarginPct = rev > 0 ? (grossProfit / rev) * 100 : 0;

        return { revenue: rev, totalCost, grossProfit, grossMarginPct };
    }

    function calculateVariance(project) {
        const projected = calculateMargin(project.projectedCosts, project.revenue);
        const actual = calculateMargin(project.actualCosts, project.revenue);

        const categoryVariances = {};
        COST_CATEGORIES.forEach(cat => {
            const proj = parseFloat(project.projectedCosts[cat.key]) || 0;
            const act = parseFloat(project.actualCosts[cat.key]) || 0;
            const diff = act - proj;
            const pctChange = proj > 0 ? (diff / proj) * 100 : (act > 0 ? 100 : 0);
            categoryVariances[cat.key] = { projected: proj, actual: act, difference: diff, percentChange: pctChange };
        });

        return {
            projected,
            actual,
            totalCostVariance: actual.totalCost - projected.totalCost,
            marginVariance: actual.grossMarginPct - projected.grossMarginPct,
            categoryVariances
        };
    }

    // ==================== WARNING SYSTEM ====================

    function evaluateMarginHealth(grossMarginPct, typeId) {
        const pType = getProjectType(typeId);
        const thresholds = pType ? pType.marginThresholds : null;
        if (!thresholds) return { level: 'unknown', label: 'N/A', message: 'No margin thresholds configured for this project type.' };

        if (grossMarginPct >= thresholds.target.min) {
            return {
                level: 'healthy',
                label: 'ON TARGET',
                message: 'Margin is within target range (' + thresholds.target.min + '-' + thresholds.target.max + '%).'
            };
        } else if (grossMarginPct >= thresholds.warning) {
            return {
                level: 'warning',
                label: 'WARNING',
                message: 'Margin (' + grossMarginPct.toFixed(1) + '%) is below target (' + thresholds.target.min + '%) but above critical threshold (' + thresholds.critical + '%). Review cost allocations.'
            };
        } else if (grossMarginPct >= thresholds.critical) {
            return {
                level: 'warning',
                label: 'WARNING',
                message: 'Margin (' + grossMarginPct.toFixed(1) + '%) is approaching critical level (' + thresholds.critical + '%). Immediate cost review recommended.'
            };
        } else {
            return {
                level: 'critical',
                label: 'CRITICAL',
                message: 'Margin (' + grossMarginPct.toFixed(1) + '%) is below critical threshold of ' + thresholds.critical + '%! This project may not be viable. Immediate review required.'
            };
        }
    }

    // ==================== PROJECT CRUD ====================

    function createProject(data) {
        const costMode = data.projectedCostMode || 'absolute';
        const project = {
            id: generateId(),
            customerName: data.customerName.trim(),
            projectName: (data.projectName || '').trim(),
            scale: data.scale,
            systemSizeKwp: isSolarType(data.scale) ? parseFloat(data.systemSizeKwp) : null,
            revenue: parseFloat(data.revenue),
            notes: (data.notes || '').trim(),
            status: 'projected',
            createdAt: new Date().toISOString(),
            completedAt: null,
            projectedCostMode: costMode,
            baseCost: costMode === 'percentage' ? (parseFloat(data.baseCost) || 0) : 0,
            projectedCostPercentages: { equipment: 0, labor: 0, permitting: 0, logistics: 0, sales: 0, overhead: 0, warranty: 0 },
            projectedCosts: { equipment: 0, labor: 0, permitting: 0, logistics: 0, sales: 0, overhead: 0, warranty: 0 },
            actualCosts: { equipment: 0, labor: 0, permitting: 0, logistics: 0, sales: 0, overhead: 0, warranty: 0 }
        };
        state.projects.unshift(project);
        saveState();
        return project;
    }

    function getProject(id) {
        return state.projects.find(p => p.id === id) || null;
    }

    function getActiveProject() {
        return state.activeProjectId ? getProject(state.activeProjectId) : null;
    }

    function deleteProject(id) {
        state.projects = state.projects.filter(p => p.id !== id);
        if (state.activeProjectId === id) state.activeProjectId = null;
        saveState();
    }

    function markCompleted(id) {
        const project = getProject(id);
        if (!project) return;
        project.status = 'completed';
        project.completedAt = new Date().toISOString();
        saveState();
    }

    function revertToProjected(id) {
        const project = getProject(id);
        if (!project) return;
        project.status = 'projected';
        project.completedAt = null;
        saveState();
    }

    function validateProject(data) {
        const errors = [];
        if (!data.customerName || !data.customerName.trim()) errors.push('Customer name is required.');
        const pType = getProjectType(data.scale);
        if (!pType) errors.push('Please select a valid project type.');
        if (isSolarType(data.scale) && (!data.systemSizeKwp || parseFloat(data.systemSizeKwp) <= 0)) {
            errors.push('System size must be a positive number for solar projects.');
        }
        if (data.revenue === undefined || data.revenue === '' || parseFloat(data.revenue) < 0) errors.push('Revenue must be zero or a positive number.');
        if (data.projectedCostMode === 'percentage' && (!data.baseCost || parseFloat(data.baseCost) <= 0)) {
            errors.push('Base cost must be a positive number when using percentage mode.');
        }
        return errors;
    }

    // ==================== FILTERING ====================

    function getFilteredProjects() {
        return state.projects.filter(p => {
            if (state.filters.search) {
                const q = state.filters.search.toLowerCase();
                const match = p.customerName.toLowerCase().includes(q)
                    || (p.projectName || '').toLowerCase().includes(q);
                if (!match) return false;
            }
            if (state.filters.scale !== 'all' && p.scale !== state.filters.scale) return false;
            if (state.filters.status !== 'all' && p.status !== state.filters.status) return false;
            return true;
        });
    }

    // ==================== RENDERING ====================

    function renderProjectList() {
        const projects = getFilteredProjects();
        if (projects.length === 0) {
            el.projectList.innerHTML = '<div class="project-list-empty">No projects found.</div>';
            return;
        }

        el.projectList.innerHTML = projects.map(p => {
            const margin = calculateMargin(p.projectedCosts, p.revenue);
            const health = evaluateMarginHealth(margin.grossMarginPct, p.scale);
            const isActive = p.id === state.activeProjectId;
            const pType = getProjectType(p.scale);
            const metaLabel = pType ? pType.label : p.scale;
            const sizeText = isSolarType(p.scale) && p.systemSizeKwp ? ' | ' + p.systemSizeKwp + ' kWp' : '';

            return '<div class="project-list-item' + (isActive ? ' active' : '') + '" data-id="' + p.id + '">'
                + '<span class="item-customer">' + escapeHtml(p.customerName) + '</span>'
                + '<span class="item-meta">' + escapeHtml(metaLabel) + sizeText + '</span>'
                + '<div class="item-bottom">'
                + '<span class="item-margin-pill ' + health.level + '">' + margin.grossMarginPct.toFixed(1) + '%</span>'
                + '<span class="item-status-pill ' + p.status + '">' + (p.status === 'completed' ? 'Completed' : 'Projected') + '</span>'
                + '</div>'
                + '</div>';
        }).join('');

        // Attach click listeners
        el.projectList.querySelectorAll('.project-list-item').forEach(item => {
            item.addEventListener('click', () => {
                state.activeProjectId = item.dataset.id;
                lastMarginValues = { revenue: 0, totalCost: 0, grossMarginPct: 0, grossProfit: 0 };
                renderProjectList();
                renderProjectDetail();
                closeSidebar();
            });
        });
    }

    function renderProjectDetail() {
        const project = getActiveProject();

        if (!project) {
            el.emptyState.classList.remove('hidden');
            el.projectDetail.classList.add('hidden');
            el.displayScale.textContent = 'No Project Selected';
            el.displayStatus.textContent = '';
            el.displayStatus.className = 'project-status-tag';
            return;
        }

        el.emptyState.classList.add('hidden');
        el.projectDetail.classList.remove('hidden');

        // Header tags
        const pType = getProjectType(project.scale);
        el.displayScale.textContent = pType ? pType.label : project.scale;
        el.displayStatus.textContent = project.status === 'completed' ? 'Completed' : 'Projected';
        el.displayStatus.className = 'project-status-tag status-' + project.status;

        // Project info
        el.infoCustomer.textContent = project.customerName + (project.projectName ? ' — ' + project.projectName : '');
        el.infoScale.textContent = pType ? pType.label : project.scale;

        // System size: show only for solar types
        const infoSizeGroup = document.getElementById('infoSizeGroup');
        if (isSolarType(project.scale) && project.systemSizeKwp) {
            el.infoSize.textContent = project.systemSizeKwp + ' kWp';
            if (infoSizeGroup) infoSizeGroup.classList.remove('hidden');
        } else {
            if (infoSizeGroup) infoSizeGroup.classList.add('hidden');
        }
        el.infoDate.textContent = formatDate(project.createdAt);

        // Notes
        const notesEl = document.getElementById('projectNotes');
        const notesContent = document.getElementById('projectNotesContent');
        if (notesEl && notesContent) {
            if (project.notes) {
                notesContent.textContent = project.notes;
                notesEl.classList.remove('hidden');
            } else {
                notesEl.classList.add('hidden');
            }
        }

        // Cost mode badge
        const costModeBadge = document.getElementById('costModeBadge');
        if (costModeBadge) {
            if (isPercentageMode(project)) {
                costModeBadge.textContent = '% of Base: ' + formatPHP(project.baseCost || 0);
                costModeBadge.classList.remove('hidden');
            } else {
                costModeBadge.classList.add('hidden');
            }
        }

        // Render cost forms
        renderCostForm(el.projectedCostsForm, project, 'projectedCosts');

        // Show/hide actual costs and comparison
        if (project.status === 'completed') {
            el.actualCostsSection.classList.remove('hidden');
            renderCostForm(el.actualCostsForm, project, 'actualCosts');

            const hasActuals = Object.values(project.actualCosts).some(v => parseFloat(v) > 0);
            if (hasActuals) {
                el.comparisonSection.classList.remove('hidden');
                renderComparison(project);
            } else {
                el.comparisonSection.classList.add('hidden');
            }

            el.btnMarkComplete.classList.add('hidden');
            el.btnRevertProject.classList.remove('hidden');
        } else {
            el.actualCostsSection.classList.add('hidden');
            el.comparisonSection.classList.add('hidden');
            el.btnMarkComplete.classList.remove('hidden');
            el.btnRevertProject.classList.add('hidden');
        }

        // Render margin cards
        renderMarginCards(project);
    }

    function renderCostForm(container, project, costType) {
        const isPctMode = costType === 'projectedCosts' && isPercentageMode(project);

        let baseCostHtml = '';
        if (isPctMode) {
            baseCostHtml = '<div class="cost-row base-cost-row">'
                + '<div class="cost-row-info">'
                + '<span class="cost-row-label">Base Cost (Ex-W / FOB / Landed)</span>'
                + '<span class="cost-row-sublabel">All percentages are calculated from this amount</span>'
                + '</div>'
                + '<input type="number" class="cost-input base-cost-input" value="' + (project.baseCost || 0) + '" min="0" step="1000" placeholder="0" aria-label="Base Cost">'
                + '</div>';
        }

        const categoryHtml = COST_CATEGORIES.map(cat => {
            if (isPctMode) {
                const pctValue = (project.projectedCostPercentages || {})[cat.key] || 0;
                const resolvedPhp = (project.baseCost || 0) * (pctValue / 100);
                return '<div class="cost-row cost-row-pct">'
                    + '<div class="cost-row-info">'
                    + '<span class="cost-row-label">' + cat.label + '</span>'
                    + '<span class="cost-row-sublabel">' + cat.sublabel + '</span>'
                    + '</div>'
                    + '<div class="cost-input-group">'
                    + '<input type="number" class="cost-input pct-input" data-cost-type="' + costType + '" data-category="' + cat.key + '" value="' + pctValue + '" min="0" max="100" step="0.1" placeholder="0" aria-label="' + cat.label + ' (%)">'
                    + '<span class="pct-suffix">%</span>'
                    + '<span class="resolved-php">' + formatPHP(resolvedPhp) + '</span>'
                    + '</div>'
                    + '</div>';
            } else {
                const value = project[costType][cat.key] || 0;
                return '<div class="cost-row">'
                    + '<div class="cost-row-info">'
                    + '<span class="cost-row-label">' + cat.label + '</span>'
                    + '<span class="cost-row-sublabel">' + cat.sublabel + '</span>'
                    + '</div>'
                    + '<input type="number" class="cost-input" data-cost-type="' + costType + '" data-category="' + cat.key + '" value="' + value + '" min="0" step="1000" placeholder="0" aria-label="' + cat.label + ' (' + (costType === 'projectedCosts' ? 'Projected' : 'Actual') + ')">'
                    + '</div>';
            }
        }).join('');

        container.innerHTML = baseCostHtml + categoryHtml;

        // Attach input listeners for category inputs
        container.querySelectorAll('.cost-input:not(.base-cost-input)').forEach(input => {
            input.addEventListener('input', debouncedCostUpdate);
        });

        // Base cost input listener (percentage mode)
        if (isPctMode) {
            const baseCostInput = container.querySelector('.base-cost-input');
            if (baseCostInput) {
                baseCostInput.addEventListener('input', debouncedBaseCostUpdate);
            }
        }
    }

    const debouncedCostUpdate = debounce(function (e) {
        const project = getActiveProject();
        if (!project) return;

        const input = e.target;
        const costType = input.dataset.costType;
        const category = input.dataset.category;
        const isPctMode = costType === 'projectedCosts' && isPercentageMode(project);

        if (isPctMode) {
            const pct = parseFloat(input.value) || 0;
            if (!project.projectedCostPercentages) project.projectedCostPercentages = {};
            project.projectedCostPercentages[category] = pct;
            const resolved = (project.baseCost || 0) * (pct / 100);
            project.projectedCosts[category] = resolved;
            const resolvedSpan = input.closest('.cost-input-group').querySelector('.resolved-php');
            if (resolvedSpan) resolvedSpan.textContent = formatPHP(resolved);
        } else {
            project[costType][category] = parseFloat(input.value) || 0;
        }

        saveState();
        renderMarginCards(project);
        renderProjectList();

        if (project.status === 'completed' && costType === 'actualCosts') {
            const hasActuals = Object.values(project.actualCosts).some(v => parseFloat(v) > 0);
            if (hasActuals) {
                el.comparisonSection.classList.remove('hidden');
                renderComparison(project);
            }
        }
    }, 300);

    const debouncedBaseCostUpdate = debounce(function (e) {
        const project = getActiveProject();
        if (!project || !isPercentageMode(project)) return;

        project.baseCost = parseFloat(e.target.value) || 0;

        // Recalculate all resolved projected costs from percentages
        COST_CATEGORIES.forEach(cat => {
            const pct = (project.projectedCostPercentages || {})[cat.key] || 0;
            project.projectedCosts[cat.key] = project.baseCost * (pct / 100);
        });

        saveState();

        // Update resolved-php displays in-place (no full re-render)
        const container = el.projectedCostsForm;
        COST_CATEGORIES.forEach(cat => {
            const input = container.querySelector('[data-category="' + cat.key + '"]');
            if (input) {
                const resolvedSpan = input.closest('.cost-input-group').querySelector('.resolved-php');
                if (resolvedSpan) resolvedSpan.textContent = formatPHP(project.projectedCosts[cat.key]);
            }
        });

        // Update cost mode badge
        const costModeBadge = document.getElementById('costModeBadge');
        if (costModeBadge) costModeBadge.textContent = '% of Base: ' + formatPHP(project.baseCost);

        renderMarginCards(project);
        renderProjectList();
    }, 300);

    function renderMarginCards(project) {
        const isCompleted = project.status === 'completed';
        const margin = calculateMargin(project.projectedCosts, project.revenue);
        const health = evaluateMarginHealth(margin.grossMarginPct, project.scale);

        // Animate values from previous to new (not always from 0)
        const prev = lastMarginValues;
        animateValue(el.metricRevenue, prev.revenue, margin.revenue, 800);
        animateValue(el.metricTotalCost, prev.totalCost, margin.totalCost, 800);
        animateValue(el.metricGrossMargin, prev.grossMarginPct, margin.grossMarginPct, 800, '%');
        animateValue(el.metricGrossProfit, prev.grossProfit, margin.grossProfit, 800);
        lastMarginValues = { revenue: margin.revenue, totalCost: margin.totalCost, grossMarginPct: margin.grossMarginPct, grossProfit: margin.grossProfit };

        // Traffic light indicator
        el.marginIndicator.textContent = health.label;
        el.marginIndicator.className = 'margin-indicator ' + health.level;

        // Card border color
        const borderColors = { healthy: 'var(--margin-healthy)', warning: 'var(--margin-warning)', critical: 'var(--margin-critical)' };
        if (el.cardGrossMargin) {
            el.cardGrossMargin.style.borderTopColor = borderColors[health.level] || 'var(--primary)';
        }

        // Warning banner (suppress for custom types with no thresholds)
        if (margin.totalCost > 0 && health.level !== 'healthy' && health.level !== 'unknown') {
            el.marginWarning.classList.remove('hidden');
            el.marginWarning.className = 'margin-warning level-' + health.level;
            el.marginWarning.innerHTML = '<strong>' + health.label + ':</strong> ' + health.message;
        } else {
            el.marginWarning.classList.add('hidden');
        }

        // Comparison metrics (if completed)
        if (isCompleted) {
            const hasActuals = Object.values(project.actualCosts).some(v => parseFloat(v) > 0);
            if (hasActuals) {
                const variance = calculateVariance(project);
                el.metricActualMargin.textContent = variance.actual.grossMarginPct.toFixed(1) + '%';
                const mv = variance.marginVariance;
                el.metricVariance.textContent = (mv >= 0 ? '+' : '') + mv.toFixed(1) + '%';
                el.metricVariance.style.color = mv >= 0 ? 'var(--variance-positive)' : 'var(--variance-negative)';
            }
        }
    }

    function renderComparison(project) {
        const variance = calculateVariance(project);

        let html = '<thead><tr>'
            + '<th style="text-align:left">Cost Category</th>'
            + '<th>Projected</th>'
            + '<th>Actual</th>'
            + '<th>Variance</th>'
            + '<th>% Change</th>'
            + '</tr></thead><tbody>';

        COST_CATEGORIES.forEach(cat => {
            const v = variance.categoryVariances[cat.key];
            const cls = v.difference > 0 ? 'variance-negative' : (v.difference < 0 ? 'variance-positive' : '');
            const sign = v.difference > 0 ? '+' : '';

            html += '<tr>'
                + '<td>' + cat.label + '</td>'
                + '<td>' + formatPHP(v.projected) + '</td>'
                + '<td>' + formatPHP(v.actual) + '</td>'
                + '<td class="' + cls + '">' + sign + formatPHP(v.difference) + '</td>'
                + '<td class="' + cls + '">' + sign + v.percentChange.toFixed(1) + '%</td>'
                + '</tr>';
        });

        // Total row
        const totalCls = variance.totalCostVariance > 0 ? 'variance-negative' : (variance.totalCostVariance < 0 ? 'variance-positive' : '');
        const totalSign = variance.totalCostVariance > 0 ? '+' : '';
        const totalPct = variance.projected.totalCost > 0
            ? ((variance.totalCostVariance / variance.projected.totalCost) * 100).toFixed(1)
            : '0.0';

        html += '<tr class="total-row">'
            + '<td>TOTAL</td>'
            + '<td>' + formatPHP(variance.projected.totalCost) + '</td>'
            + '<td>' + formatPHP(variance.actual.totalCost) + '</td>'
            + '<td class="' + totalCls + '">' + totalSign + formatPHP(variance.totalCostVariance) + '</td>'
            + '<td class="' + totalCls + '">' + totalSign + totalPct + '%</td>'
            + '</tr></tbody>';

        el.comparisonTable.innerHTML = html;
    }

    // ==================== CSV EXPORT ====================

    function downloadCSV(rows, filename) {
        const csv = rows.map(row =>
            Array.isArray(row)
                ? row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')
                : ''
        ).join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportProjectCSV(project) {
        const projected = calculateMargin(project.projectedCosts, project.revenue);
        const rows = [];
        const pType = getProjectType(project.scale);

        rows.push(['Project Margin Report']);
        rows.push(['']);
        rows.push(['Customer', project.customerName]);
        rows.push(['Project', project.projectName || 'N/A']);
        rows.push(['Type', pType ? pType.label : project.scale]);
        if (isSolarType(project.scale) && project.systemSizeKwp) {
            rows.push(['System Size', project.systemSizeKwp + ' kWp']);
        }
        rows.push(['Contract Revenue', project.revenue]);
        rows.push(['Cost Entry Mode', isPercentageMode(project) ? 'Percentage of Base Cost' : 'Absolute (PHP)']);
        if (isPercentageMode(project)) {
            rows.push(['Base Cost (Ex-W/FOB/Landed)', project.baseCost || 0]);
        }
        rows.push(['Status', project.status]);
        rows.push(['Created', formatDate(project.createdAt)]);
        if (project.completedAt) rows.push(['Completed', formatDate(project.completedAt)]);
        rows.push(['']);

        rows.push(['PROJECTED COSTS']);
        if (isPercentageMode(project)) {
            COST_CATEGORIES.forEach(cat => {
                const pct = (project.projectedCostPercentages || {})[cat.key] || 0;
                rows.push([cat.label, pct + '%', project.projectedCosts[cat.key] || 0]);
            });
        } else {
            COST_CATEGORIES.forEach(cat => {
                rows.push([cat.label, project.projectedCosts[cat.key] || 0]);
            });
        }
        rows.push(['Total Projected Cost', projected.totalCost]);
        rows.push(['Projected Gross Profit', projected.grossProfit]);
        rows.push(['Projected Gross Margin', projected.grossMarginPct.toFixed(1) + '%']);
        rows.push(['']);

        if (project.status === 'completed') {
            const variance = calculateVariance(project);

            rows.push(['ACTUAL COSTS']);
            COST_CATEGORIES.forEach(cat => {
                rows.push([cat.label, project.actualCosts[cat.key] || 0]);
            });
            rows.push(['Total Actual Cost', variance.actual.totalCost]);
            rows.push(['Actual Gross Profit', variance.actual.grossProfit]);
            rows.push(['Actual Gross Margin', variance.actual.grossMarginPct.toFixed(1) + '%']);
            rows.push(['']);

            rows.push(['VARIANCE ANALYSIS', 'Projected', 'Actual', 'Variance', '% Change']);
            COST_CATEGORIES.forEach(cat => {
                const v = variance.categoryVariances[cat.key];
                rows.push([cat.label, v.projected, v.actual, v.difference, v.percentChange.toFixed(1) + '%']);
            });
            rows.push(['TOTAL', variance.projected.totalCost, variance.actual.totalCost,
                variance.totalCostVariance,
                (variance.projected.totalCost > 0 ? ((variance.totalCostVariance / variance.projected.totalCost) * 100).toFixed(1) : '0.0') + '%']);
            rows.push(['']);
            rows.push(['Margin Variance', variance.marginVariance.toFixed(1) + '%']);
        }

        downloadCSV(rows, 'Margins_' + project.customerName.replace(/\s+/g, '_') + '_' + Date.now() + '.csv');
    }

    function exportAllCSV() {
        if (state.projects.length === 0) return;

        const rows = [['Customer', 'Project', 'Type', 'System Size', 'Revenue (PHP)',
            'Projected Cost', 'Projected Margin %', 'Status',
            'Actual Cost', 'Actual Margin %', 'Created']];

        state.projects.forEach(p => {
            const proj = calculateMargin(p.projectedCosts, p.revenue);
            const act = p.status === 'completed' ? calculateMargin(p.actualCosts, p.revenue) : null;
            const pType = getProjectType(p.scale);
            rows.push([
                p.customerName,
                p.projectName || '',
                pType ? pType.label : p.scale,
                isSolarType(p.scale) && p.systemSizeKwp ? p.systemSizeKwp + ' kWp' : '',
                p.revenue,
                proj.totalCost,
                proj.grossMarginPct.toFixed(1) + '%',
                p.status,
                act ? act.totalCost : '',
                act ? act.grossMarginPct.toFixed(1) + '%' : '',
                formatDate(p.createdAt)
            ]);
        });

        downloadCSV(rows, 'Kinmo_All_Margins_' + Date.now() + '.csv');
    }

    // ==================== MODAL HELPERS ====================

    function openModal(modal) {
        modal.classList.add('active');
    }

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    // ==================== MOBILE SIDEBAR ====================

    function openSidebar() {
        el.sidebar.classList.add('active');
        el.sidebarOverlay.classList.add('active');
    }

    function closeSidebar() {
        el.sidebar.classList.remove('active');
        el.sidebarOverlay.classList.remove('active');
    }

    // ==================== HTML ESCAPE ====================

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== DROPDOWN MANAGEMENT ====================

    function populateDropdowns() {
        // Sidebar filter
        el.filterScale.innerHTML = '<option value="all">All Types</option>'
            + state.projectTypes.map(t =>
                '<option value="' + t.id + '">' + escapeHtml(t.label) + '</option>'
            ).join('');

        // New project modal (with "Add Custom" option)
        el.newProjectScale.innerHTML = '<option value="" disabled selected>Select type...</option>'
            + state.projectTypes.map(t =>
                '<option value="' + t.id + '">' + escapeHtml(t.label) + '</option>'
            ).join('')
            + '<option value="__custom__">+ Add Custom Type...</option>';

        // Custom types list with delete buttons
        const customTypes = state.projectTypes.filter(t => !t.builtIn);
        if (customTypes.length > 0 && el.customTypesList) {
            el.customTypesList.innerHTML = '<span class="custom-types-header">Custom Types</span>'
                + customTypes.map(t => {
                    const inUse = state.projects.some(p => p.scale === t.id);
                    return '<div class="custom-type-item" data-type-id="' + t.id + '">'
                        + '<span class="custom-type-label">' + escapeHtml(t.label) + '</span>'
                        + (inUse ? '' : '<button class="custom-type-delete" title="Delete type">&times;</button>')
                        + '</div>';
                }).join('');

            el.customTypesList.querySelectorAll('.custom-type-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const typeId = btn.closest('.custom-type-item').dataset.typeId;
                    deleteCustomType(typeId);
                });
            });
        } else if (el.customTypesList) {
            el.customTypesList.innerHTML = '';
        }
    }

    function deleteCustomType(typeId) {
        const pType = getProjectType(typeId);
        if (!pType || pType.builtIn) return;
        const inUse = state.projects.some(p => p.scale === typeId);
        if (inUse) return;
        state.projectTypes = state.projectTypes.filter(t => t.id !== typeId);
        saveState();
        populateDropdowns();
    }

    function showCustomTypeCreator() {
        el.customTypeForm.classList.remove('hidden');
        el.customTypeName.value = '';
        el.thresholdTarget.value = '';
        el.thresholdWarning.value = '';
        el.thresholdCritical.value = '';
        el.newProjectScale.value = '';
        el.newProjectScale.disabled = true;
        setTimeout(() => el.customTypeName.focus(), 50);
    }

    function hideCustomTypeCreator() {
        el.customTypeForm.classList.add('hidden');
        el.newProjectScale.disabled = false;
    }

    function createCustomType() {
        const name = el.customTypeName.value.trim();
        if (!name) {
            el.customTypeName.focus();
            return;
        }

        let marginThresholds = null;
        const target = parseFloat(el.thresholdTarget.value);
        const warning = parseFloat(el.thresholdWarning.value);
        const critical = parseFloat(el.thresholdCritical.value);

        if (!isNaN(target) && !isNaN(warning) && !isNaN(critical)) {
            if (target > warning && warning > critical && critical >= 0) {
                marginThresholds = {
                    target: { min: target, max: target + 10 },
                    warning: warning,
                    critical: critical
                };
            }
        }

        const newType = {
            id: 'type_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            label: name,
            category: 'custom',
            builtIn: false,
            ratePerKwp: null,
            marginThresholds: marginThresholds
        };
        state.projectTypes.push(newType);
        saveState();
        hideCustomTypeCreator();
        populateDropdowns();
        el.newProjectScale.value = newType.id;
        el.newProjectScale.dispatchEvent(new Event('change'));
    }

    function updateSystemSizeVisibility(typeId) {
        const group = document.getElementById('systemSizeGroup');
        if (!group) return;
        if (isSolarType(typeId)) {
            group.classList.remove('hidden');
            el.newSystemSize.required = true;
        } else {
            group.classList.add('hidden');
            el.newSystemSize.required = false;
            el.newSystemSize.value = '';
        }
    }

    // ==================== AUTO-SUGGEST REVENUE ====================

    function updateSuggestedRevenue() {
        const typeId = el.newProjectScale.value;
        const pType = getProjectType(typeId);
        const size = parseFloat(el.newSystemSize.value) || 0;
        if (pType && pType.ratePerKwp && size > 0 && !el.newRevenue.dataset.userModified) {
            el.newRevenue.value = size * pType.ratePerKwp;
        }
    }

    // ==================== EVENT LISTENERS ====================

    // Mobile sidebar
    el.mobileToggle.addEventListener('click', openSidebar);
    el.sidebarOverlay.addEventListener('click', closeSidebar);

    // New project modal
    el.btnNewProject.addEventListener('click', () => {
        // Reset modal state when opening — hide System Size until solar type selected
        const sizeGroup = document.getElementById('systemSizeGroup');
        if (sizeGroup) sizeGroup.classList.add('hidden');
        el.newSystemSize.required = false;
        el.newRevenue.dataset.userModified = '';
        el.newCostMode.value = 'absolute';
        el.baseCostGroup.classList.add('hidden');
        el.newBaseCost.required = false;
        el.newBaseCost.value = '';
        el.formErrors.classList.add('hidden');
        hideCustomTypeCreator();
        openModal(el.newProjectModal);
    });
    el.modalCloseNew.addEventListener('click', () => closeModal(el.newProjectModal));
    el.newProjectModal.addEventListener('click', (e) => {
        if (e.target === el.newProjectModal) closeModal(el.newProjectModal);
    });

    // Project type change: handle custom type creation, field visibility, auto-suggest
    el.newProjectScale.addEventListener('change', () => {
        const typeId = el.newProjectScale.value;
        if (typeId === '__custom__') {
            showCustomTypeCreator();
            return;
        }
        updateSystemSizeVisibility(typeId);
        updateSuggestedRevenue();
    });
    el.newSystemSize.addEventListener('input', updateSuggestedRevenue);
    el.newRevenue.addEventListener('input', () => {
        el.newRevenue.dataset.userModified = 'true';
    });

    // Cost mode toggle
    el.newCostMode.addEventListener('change', () => {
        if (el.newCostMode.value === 'percentage') {
            el.baseCostGroup.classList.remove('hidden');
            el.newBaseCost.required = true;
        } else {
            el.baseCostGroup.classList.add('hidden');
            el.newBaseCost.required = false;
            el.newBaseCost.value = '';
        }
    });

    // Custom type inline form
    el.btnCreateType.addEventListener('click', createCustomType);
    el.btnCancelType.addEventListener('click', () => {
        hideCustomTypeCreator();
        el.newProjectScale.value = '';
    });
    el.customTypeName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createCustomType();
        }
    });

    // New project form submit
    el.newProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const data = {
            customerName: el.newCustomerName.value,
            projectName: el.newProjectName.value,
            scale: el.newProjectScale.value,
            systemSizeKwp: el.newSystemSize.value,
            revenue: el.newRevenue.value,
            projectedCostMode: el.newCostMode.value,
            baseCost: el.newBaseCost.value,
            notes: el.newNotes.value
        };

        const errors = validateProject(data);
        if (errors.length > 0) {
            el.formErrors.innerHTML = errors.map(err => '<div>' + err + '</div>').join('');
            el.formErrors.classList.remove('hidden');
            return;
        }

        el.formErrors.classList.add('hidden');
        const project = createProject(data);
        state.activeProjectId = project.id;

        closeModal(el.newProjectModal);
        el.newProjectForm.reset();
        el.newRevenue.dataset.userModified = '';

        renderProjectList();
        renderProjectDetail();
    });

    // Filters
    const debouncedSearch = debounce(() => {
        state.filters.search = el.projectSearch.value;
        renderProjectList();
    }, 200);

    el.projectSearch.addEventListener('input', debouncedSearch);
    el.filterScale.addEventListener('change', () => {
        state.filters.scale = el.filterScale.value;
        renderProjectList();
    });
    el.filterStatus.addEventListener('change', () => {
        state.filters.status = el.filterStatus.value;
        renderProjectList();
    });

    // Mark complete — open confirmation modal
    el.btnMarkComplete.addEventListener('click', () => {
        const project = getActiveProject();
        if (!project) return;
        openModal(el.completeModal);
    });
    el.btnCancelComplete.addEventListener('click', () => closeModal(el.completeModal));
    el.completeModal.addEventListener('click', (e) => {
        if (e.target === el.completeModal) closeModal(el.completeModal);
    });
    el.btnConfirmComplete.addEventListener('click', () => {
        const project = getActiveProject();
        if (project) {
            markCompleted(project.id);
            closeModal(el.completeModal);
            renderProjectDetail();
            renderProjectList();
        }
    });

    // Revert to projected — open confirmation modal
    el.btnRevertProject.addEventListener('click', () => {
        const project = getActiveProject();
        if (!project) return;
        openModal(el.revertModal);
    });
    el.btnCancelRevert.addEventListener('click', () => closeModal(el.revertModal));
    el.revertModal.addEventListener('click', (e) => {
        if (e.target === el.revertModal) closeModal(el.revertModal);
    });
    el.btnConfirmRevert.addEventListener('click', () => {
        const project = getActiveProject();
        if (project) {
            revertToProjected(project.id);
            closeModal(el.revertModal);
            renderProjectDetail();
            renderProjectList();
        }
    });

    // Export
    el.btnExportProject.addEventListener('click', () => {
        const project = getActiveProject();
        if (project) exportProjectCSV(project);
    });
    el.btnExportAll.addEventListener('click', exportAllCSV);

    // Delete project
    el.btnDeleteProject.addEventListener('click', () => openModal(el.deleteModal));
    el.btnCancelDelete.addEventListener('click', () => closeModal(el.deleteModal));
    el.deleteModal.addEventListener('click', (e) => {
        if (e.target === el.deleteModal) closeModal(el.deleteModal);
    });
    el.btnConfirmDelete.addEventListener('click', () => {
        const project = getActiveProject();
        if (project) {
            deleteProject(project.id);
            closeModal(el.deleteModal);
            renderProjectList();
            renderProjectDetail();
        }
    });

    // Clear all data — open confirmation modal
    el.btnClearData.addEventListener('click', () => {
        if (state.projects.length === 0) return;
        openModal(el.clearAllModal);
    });
    el.btnCancelClearAll.addEventListener('click', () => closeModal(el.clearAllModal));
    el.clearAllModal.addEventListener('click', (e) => {
        if (e.target === el.clearAllModal) closeModal(el.clearAllModal);
    });
    el.btnConfirmClearAll.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        state.projects = [];
        state.activeProjectId = null;
        closeModal(el.clearAllModal);
        renderProjectList();
        renderProjectDetail();
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            [el.newProjectModal, el.deleteModal, el.completeModal, el.clearAllModal, el.revertModal].forEach(modal => {
                if (modal.classList.contains('active')) closeModal(modal);
            });
        }
    });

    // ==================== INITIALIZATION ====================

    loadState();
    populateDropdowns();
    renderProjectList();
    renderProjectDetail();

});
