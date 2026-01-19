import streamlit as st
import math

# Page configuration
st.set_page_config(
    page_title="Solar Feasibility and Requirement Tool",
    page_icon="lightning_bolt",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Premium Custom CSS
st.markdown("""
    <style>
    /* Main background */
    .stApp {
        background: #f8fafc;
        color: #1e293b;
    }
    
    /* Sidebar styling */
    section[data-testid="stSidebar"] {
        background-color: #002B5B !important;
        color: white !important;
    }
    
    section[data-testid="stSidebar"] .stMarkdown, section[data-testid="stSidebar"] .stText {
        color: white !important;
    }

    section[data-testid="stSidebar"] label {
        color: white !important;
    }
    
    section[data-testid="stSidebar"] [data-testid="stHeader"] {
        background-color: rgba(0,0,0,0) !important;
    }

    /* Sidebar Headers to White */
    section[data-testid="stSidebar"] h1, 
    section[data-testid="stSidebar"] h2, 
    section[data-testid="stSidebar"] h3,
    section[data-testid="stSidebar"] h4 {
        color: white !important;
    }
    
    /* Sidebar Input Styling - Direct overrides for Streamlit Cloud */
    [data-testid="stSidebar"] [data-testid="stWidgetLabel"] p {
        color: white !important;
    }

    /* Force white background and black text for ALL sidebar inputs */
    [data-testid="stSidebar"] [data-baseweb="input"],
    [data-testid="stSidebar"] [data-baseweb="select"] > div,
    [data-testid="stSidebar"] [data-baseweb="select"] {
        background-color: white !important;
        color: black !important;
        border-radius: 8px !important;
    }

    /* Ensure the actual input text is black */
    [data-testid="stSidebar"] input {
        color: black !important;
        background-color: white !important;
        -webkit-text-fill-color: black !important;
    }

    /* Fix the Selectbox dropdown and text */
    [data-testid="stSidebar"] [data-baseweb="select"] * {
        color: black !important;
    }

    /* Style the +/- buttons in number input */
    [data-testid="stSidebar"] [data-testid="stNumberInput"] button {
        background-color: white !important;
        color: black !important;
        border: 1px solid #e2e8f0 !important;
    }
    
    [data-testid="stSidebar"] [data-testid="stNumberInput"] button:hover {
        background-color: #f8fafc !important;
    }

    /* Make the clear button (x) and its container transparent */
    [data-testid="stSidebar"] [data-baseweb="input"] > div:last-child,
    [data-testid="stSidebar"] [role="button"][aria-label="Clear value"],
    [data-testid="stSidebar"] [role="button"][title="Clear value"] {
        background-color: transparent !important;
    }
    
    /* Style the clear icon (x) itself */
    [data-testid="stSidebar"] svg[title="Clear value"],
    [data-testid="stSidebar"] svg[aria-label="Clear value"] {
        fill: #64748b !important;
    }
    
    [data-testid="stSidebar"] svg[title="Clear value"]:hover,
    [data-testid="stSidebar"] svg[aria-label="Clear value"]:hover {
        fill: #1e293b !important;
    }

    /* Logo Seamless Circular integration */
    [data-testid="stSidebar"] [data-testid="stImage"] img {
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        background-color: white !important;
        padding: 5px;
    }

    /* CTA Button Styles */
    .btn-primary {
        display: block;
        width: 100%;
        background: #0084FF;
        color: white !important;
        padding: 1.25rem;
        border-radius: 1rem;
        font-weight: 700;
        text-decoration: none !important;
        text-align: center;
        font-size: 1.1rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: none;
        box-shadow: 0 10px 15px -3px rgba(0, 132, 255, 0.4);
        margin: 1.5rem 0;
    }

    .btn-primary:hover {
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 20px 25px -5px rgba(0, 132, 255, 0.5);
        background: #0073e6;
    }
    
    /* Metric cards */
    [data-testid="stMetricValue"] {
        color: #002B5B;
        font-weight: 700;
    }
    
    [data-testid="stMetricLabel"] {
        color: #64748b;
    }
    
    /* Savings box styling */
    .savings-box {
        background: #fefce8;
        border: 1px solid #fef08a;
        padding: 24px;
        border-radius: 16px;
        margin: 10px 0;
    }

    /* Footer styling - Black font */
    .footer {
        margin-top: 50px;
        padding: 40px;
        border-top: 1px solid #e2e8f0;
        text-align: center;
        color: #000000 !important;
        background: #f1f5f9;
        border-radius: 0 0 16px 16px;
    }
    
    .footer h3, .footer p, .footer strong {
        color: #000000 !important;
    }
    
    .footer a {
        color: #002B5B;
        text-decoration: none;
        font-weight: bold;
    }
    
    .footer a:hover {
        text-decoration: underline;
    }
    
    h1, h2, h3, h4 {
        color: #0f172a !important;
        font-family: 'Inter', sans-serif;
    }
    
    .stWarning, .stAlert, [data-testid="stNotificationContent"] {
        background-color: #fffbeb !important;
        border-color: #facc15 !important;
        color: #000000 !important;
    }

    /* Target all text inside alerts to be black */
    .stAlert p, .stAlert div, .stAlert span, .stAlert h1, .stAlert h2, .stAlert h3 {
        color: #000000 !important;
    }

    .info-tag {
        background: #002B5B;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8em;
        font-weight: bold;
        display: inline-block;
        margin-bottom: 20px;
    }

    /* Hide specific UI elements while keeping sidebar toggle */
    header[data-testid="stHeader"] {
        background: transparent !important;
    }
    button[data-testid="baseButton-header"] {
        display: none !important;
    }
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    [data-testid="stDeployButton"] {display: none;}
    </style>
    """, unsafe_allow_html=True)

# Sidebar Inputs
st.sidebar.image("logo.png", width="stretch")
st.sidebar.header("System Inputs")

project_scale = st.sidebar.selectbox(
    "Project Scale",
    ["Residential", "C&I", "Utility Scale"],
    help="Residential (up to 20kWp), C&I (21-300kWp), Utility (>300kWp)"
)

system_type = st.sidebar.selectbox("System Type", ["Grid-Tied", "Hybrid", "Off-Grid"])

# Scale-based defaults and load profile
if project_scale == "Residential":
    battery_options = {"5kWh": 5, "10kWh": 10, "15kWh": 15}
    default_daytime_pct = 30
elif project_scale == "C&I":
    battery_options = {"15kWh": 15, "100kWh": 100, "215kWh": 215, "1MWh": 1000}
    default_daytime_pct = 70
else: # UtilityScale
    battery_options = {"215kWh": 215, "1MWh": 1000}
    default_daytime_pct = 10

bill = st.sidebar.number_input(
    "Average Electricity Bill (PHP)", 
    min_value=0.0, 
    max_value=100000000.0, 
    value=None, 
    step=500.0,
    placeholder="Enter amount"
)

rate = st.sidebar.number_input(
    "Average Monthly Total Electricity Rate (Php/kwh)", 
    min_value=1.0, 
    max_value=50.0, 
    value=None, 
    step=0.1,
    placeholder="Enter rate"
)

# Expected Solar Consumption (Locked to 100% for Off-Grid)
if system_type == "Off-Grid":
    st.sidebar.info("Off-Grid systems require 100% target coverage.")
    solar_target_pct = 100
else:
    solar_target_pct = st.sidebar.slider(
        "Expected Solar Consumption %", 
        min_value=0, 
        max_value=100, 
        value=100
    )

available_area = st.sidebar.number_input(
    "Available Roof/Land Area (sqm)", 
    min_value=0.0, 
    value=None, 
    step=5.0, 
    placeholder="Enter area"
)

module_wattage = st.sidebar.number_input("PV Module Wattage (Wp)", min_value=100, max_value=800, value=620, step=10)

# Daytime Load Split (Always visible)
daytime_load_pct = st.sidebar.slider(
    "Daytime Load Split %",
    0, 100, default_daytime_pct,
    help="Percentage of your daily electricity consumption that occurs during sun hours (approx 8am-4pm)."
)
direct_cons_rate = daytime_load_pct / 100

# Handle None values
safe_bill = bill if bill is not None else 0.0
safe_rate = rate if rate is not None else 0.0
safe_area = available_area if available_area is not None else 0.0

# Fixed Panel Size
# 3sqm is used to allot for spacing and other installation constraints.
PANEL_SIZE_SQM = 3.0
st.sidebar.info(f"Panel Size: {PANEL_SIZE_SQM} sqm (Includes spacing and installation constraints)")

# Battery Configuration Settings (Conditional)
if system_type in ["Hybrid", "Off-Grid"]:
    st.sidebar.markdown("---")
    st.sidebar.subheader("Battery Configuration")
    backup_hours = st.sidebar.slider("Backup Duration (Hours)", 1, 24, 4)
    selected_battery_label = st.sidebar.selectbox("Battery Unit Size", list(battery_options.keys()), index=len(battery_options)-1)
    battery_unit_kwh = battery_options[selected_battery_label]
else:
    backup_hours = 0
    # Provide defaults for recommendation logic even if hidden
    selected_battery_label = list(battery_options.keys())[len(battery_options)-1]
    battery_unit_kwh = battery_options[selected_battery_label]

# Advanced Features
if system_type != "Off-Grid":
    st.sidebar.markdown("---")
    st.sidebar.subheader("Advanced Features")
    enable_net_metering = st.sidebar.checkbox("Enable Net Metering Calculations", value=False)
    if enable_net_metering:
        gen_charge_rate = st.sidebar.number_input(
            "Average Generation Charge Cost (Php/kwh)",
            min_value=0.0,
            max_value=safe_rate if safe_rate > 0 else 50.0,
            value=5.5 if safe_rate == 0 else min(5.5, safe_rate * 0.5),
            step=0.1,
            help="Rate at which the utility buys your excess solar power."
        )
    else:
        gen_charge_rate = 0.0
else:
    enable_net_metering = False
    gen_charge_rate = 0.0

# Core Logic Constants
PSH = 4.0 # Peak Sun Hours
EFFICIENCY = 0.80

# Calculations
monthly_kwh = safe_bill / safe_rate if safe_rate > 0 else 0
daily_kwh = monthly_kwh / 30
target_daily_solar_kwh = daily_kwh * (solar_target_pct / 100)

# Design efficiency adjustment: Off-grid needs extra headroom for battery charging and autonomy
design_factor = 1.25 if system_type == "Off-Grid" else 1.0
required_kwp = (target_daily_solar_kwh / (PSH * EFFICIENCY)) * design_factor if (PSH * EFFICIENCY) > 0 else 0

# Even Panel counts (rounding down)
raw_panels_req = math.ceil((required_kwp * 1000) / module_wattage) if module_wattage > 0 else 0
num_panels_required = (raw_panels_req // 2) * 2

raw_panels_poss = math.floor(safe_area / PANEL_SIZE_SQM) if PANEL_SIZE_SQM > 0 else 0
total_panels_possible = (raw_panels_poss // 2) * 2
possible_kwp = (total_panels_possible * module_wattage) / 1000

# Final Metrics (Cap at possible)
display_panels = min(num_panels_required, total_panels_possible)
display_kwp = (display_panels * module_wattage) / 1000
display_area = display_panels * PANEL_SIZE_SQM

# Resulting production
effective_daily_solar_kwh = display_kwp * PSH * EFFICIENCY
daytime_kwh_load = daily_kwh * direct_cons_rate
nighttime_kwh_load = daily_kwh - daytime_kwh_load

# 1. Grid-Tied (Direct Consumption Only)
direct_consumed_kwh = min(effective_daily_solar_kwh, daytime_kwh_load)
surplus_solar_kwh = max(0.0, effective_daily_solar_kwh - daytime_kwh_load)

# 2. Net Metering
# surplus_solar_kwh is exported

# 3. PV + Battery
# For the purpose of savings calculation, we assume battery is used to shift surplus to night
# Number of batteries is calculated based on system type but for category 3 comparison we can show impact of current selection
avg_hourly_load = daily_kwh / 24 if daily_kwh > 0 else 0
backup_storage_needed = avg_hourly_load * backup_hours if backup_hours > 0 else 0

# Estimate how many batteries are needed for this PV + Battery scenario
# We'll use the selected battery size to show impact
if system_type in ["Hybrid", "Off-Grid"]:
    num_batt_scenario = math.ceil(backup_storage_needed / battery_unit_kwh) if battery_unit_kwh > 0 else 0
else:
    # If grid-tied, suggest enough battery to cover the surplus or at least one unit
    num_batt_scenario = math.ceil(surplus_solar_kwh / battery_unit_kwh) if battery_unit_kwh > 0 else 1

battery_capacity_total = num_batt_scenario * battery_unit_kwh
# We assume 90% usable capacity for lithium
usable_battery_kwh = battery_capacity_total * 0.9
battery_shifted_kwh = min(surplus_solar_kwh, usable_battery_kwh, nighttime_kwh_load)

max_possible_offset = (effective_daily_solar_kwh / daily_kwh * 100) if daily_kwh > 0 else 0

# Scale Suggestion
actual_category = ""
if display_kwp <= 20: actual_category = "Residential"
elif 20 < display_kwp <= 300: actual_category = "C&I"
else: actual_category = "Utility Scale"

# Main Screen
st.title("Kinmo PW Solar Feasibility Tool")
st.markdown(f'<div class="info-tag">{project_scale} Project</div>', unsafe_allow_html=True)

st.markdown(f"""
    <div style="margin-top: 10px; margin-bottom: 25px;">
        <p style="color: #4b5563; font-size: 1.05em; line-height: 1.5;">
            This tool provides a rapid assessment of your solar energy potential, calculating required capacity and estimated bill offsets based on your available space and monthly consumption.
        </p>
        <div style="background-color: #fefce8; border: 1px solid #fef08a; padding: 12px 16px; border-radius: 8px; margin-top: 15px;">
            <p style="margin: 0; font-size: 0.92em; color: #854d0e;">
                <b>* Rough Estimate Only:</b> These results are projections based on standard environmental conditions and theoretical calculations. 
                Actual performance depends on site-specific factors like shading, orientation, and local weather.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 0.92em; color: #854d0e;">
                <b>Note on Costs:</b> This view displays <b>expected savings only</b>. System hardware, labor, and permit costs are not included here. 
                Please <b>request a formal quotation</b> for a complete financial analysis and ROI computation.
            </p>
            <p style="margin: 8px 0 0 0; font-size: 0.92em; font-weight: 600; color: #1e40af;">
                For inquiries or technical consultation, please contact our support team.
            </p>
        </div>
    </div>
""", unsafe_allow_html=True)
st.markdown("---")

if project_scale != actual_category:
    st.info(f"Note: System sized as **{actual_category}** ({display_kwp:.1f} kWp). Consider aligning Project Scale for optimized battery options.")

if num_panels_required > total_panels_possible:
    st.warning(f"Warning: Space insufficient for {solar_target_pct}% target. Available area ({available_area}m²) limits system to {total_panels_possible} panels ({max_possible_offset:.1f}% offset).")

# Metrics
if system_type in ["Hybrid", "Off-Grid"]:
    col1, col2, col3, col4 = st.columns(4)
    with col4: st.metric("Total Storage", f"{battery_capacity_total:.1f} kWh")
else:
    col1, col2, col3 = st.columns(3)

with col1: st.metric("System Capacity", f"{display_kwp:.2f} kWp")
with col2: st.metric("Number of Panels", f"{display_panels}")
with col3: st.metric("Total Area Used", f"{display_area:.1f} m²")

st.markdown("### Savings and Offset Analysis")

# Logic for results
# Scenario 1: Self-Consumption (Direct + Battery Shift for Hybrid/Off-Grid)
if system_type == "Grid-Tied":
    c1_daily_savings_kwh = direct_consumed_kwh
    c1_title = "Grid-Tied (Direct)"
    c1_desc = f"Direct self-consumption based on {daytime_load_pct}% daytime load"
    residual_surplus_kwh = surplus_solar_kwh
elif system_type == "Hybrid":
    c1_daily_savings_kwh = direct_consumed_kwh + battery_shifted_kwh
    c1_title = "Hybrid (PV + Battery)"
    c1_desc = f"Direct cons. + {backup_hours}h battery backup usage"
    residual_surplus_kwh = max(0.0, surplus_solar_kwh - usable_battery_kwh)
else: # Off-Grid
    c1_daily_savings_kwh = direct_consumed_kwh + battery_shifted_kwh
    c1_title = "Off-Grid (PV + Battery)"
    c1_desc = f"Full 24h operation coverage ({backup_hours}h storage config)"
    residual_surplus_kwh = 0.0

c1_monthly_savings_php = min(c1_daily_savings_kwh * 30 * safe_rate, bill if bill is not None else 0.0)
c1_offset = min((c1_daily_savings_kwh / daily_kwh * 100) if daily_kwh > 0 else 0, 100.0)

# Scenario 2: With Net Metering (Exporting Residual Surplus)
if system_type != "Off-Grid":
    # Value = (Savings from self-consumption) + (Credit from selling remaining surplus)
    c2_gross_monthly_savings = (c1_daily_savings_kwh * 30 * safe_rate) + (residual_surplus_kwh * 30 * gen_charge_rate)
    c2_monthly_savings_php = min(c2_gross_monthly_savings, bill if bill is not None else 0.0)
    # Offset is typically total solar generated / daily load if counting export value
    c2_offset = min((effective_daily_solar_kwh / daily_kwh * 100) if daily_kwh > 0 else 0, 100.0)
else:
    c2_gross_monthly_savings = 0.0
    c2_monthly_savings_php = 0.0
    c2_offset = 0.0

# Adding Yearly for internal use in cards
c1_yearly_savings = c1_monthly_savings_php * 12
c2_yearly_savings = c2_monthly_savings_php * 12

# Result Cards
col_c1, col_c2 = st.columns(2)

with col_c1:
    st.markdown(f"""
    <div class="savings-box" style="border-color:#002B5B; background:#f0f9ff;">
        <h4 style="margin-top:0; color:#002B5B;">1. {c1_title}</h4>
        <p style="font-size:0.85em; color:#64748b; margin-bottom:10px;">{c1_desc}</p>
        <h2 style="color:#22c55e; margin: 5px 0;">₱ {c1_monthly_savings_php:,.2f}</h2>
        <p style="font-weight:bold; color:#002B5B; margin:0;">{c1_offset:.1f}% Bill Offset</p>
        <p style="font-size:0.85em; color:#64748b; margin-top:5px;">Est. ₱ {c1_yearly_savings:,.0f} / year</p>
    </div>
    """, unsafe_allow_html=True)

with col_c2:
    if system_type != "Off-Grid":
        if enable_net_metering:
            st.markdown(f"""
            <div class="savings-box" style="border-color:#3b82f6; background:#eff6ff;">
                <h4 style="margin-top:0; color:#1e40af;">2. With Net Metering</h4>
                <p style="font-size:0.85em; color:#64748b; margin-bottom:10px;">Exporting {residual_surplus_kwh*30:.1f} kWh/mo surplus after battery</p>
                <h2 style="color:#3b82f6; margin: 5px 0;">₱ {c2_monthly_savings_php:,.2f}</h2>
                <p style="font-weight:bold; color:#002B5B; margin:0;">{c2_offset:.1f}% Total Offset</p>
                <p style="font-size:0.85em; color:#64748b; margin-top:5px;">Est. ₱ {c2_yearly_savings:,.0f} / year</p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="savings-box" style="opacity:0.7; background:#f8fafc; border-style:dashed;">
                <h4 style="margin-top:0; color:#94a3b8;">2. With Net Metering</h4>
                <p style="font-size:0.85em; color:#94a3b8; margin-bottom:10px;">(Optional Advanced Feature)</p>
                <h2 style="color:#cbd5e1; margin: 5px 0;">₱ --</h2>
                <p style="font-weight:bold; color:#cbd5e1; margin:0;">Enable in Sidebar</p>
                <p style="font-size:0.85em; color:#cbd5e1; margin-top:5px;">Check Gen. Charge rates</p>
            </div>
            """, unsafe_allow_html=True)
    else:
        # Off-grid doesn't have net-metering. Show a summary of lost surplus instead?
        st.markdown(f"""
        <div class="savings-box" style="background:#fff7ed; border-color:#fb923c;">
            <h4 style="margin-top:0; color:#c2410c;">Off-Grid System Note</h4>
            <p style="font-size:0.85em; color:#9a3412; margin-bottom:10px;">Full independence from the grid.</p>
            <h2 style="color:#c2410c; margin: 5px 0;">Off-Grid</h2>
            <p style="font-weight:bold; color:#002B5B; margin:0;">No Grid connection</p>
            <p style="font-size:0.85em; color:#9a3412; margin-top:5px;">Relies 100% on PV + Battery</p>
        </div>
        """, unsafe_allow_html=True)

# Battery Assessment
st.markdown("---")
st.markdown("### System Configuration Details")

# Layout for technical details
tcol1, tcol2 = st.columns(2)

with tcol1:
    st.write(f"**Energy Flow Summary:**")
    st.write(f"- Monthly Solar Generation: **{effective_daily_solar_kwh*30:.1f} kWh**")
    st.write(f"- Direct Consumption: **{direct_consumed_kwh*30:.1f} kWh** ({daytime_load_pct}% Daytime split)")
    if surplus_solar_kwh > 0:
        st.write(f"- Surplus Solar (Export/Store): **{surplus_solar_kwh*30:.1f} kWh**")
    st.write(f"- Monthly Usage Requirement: **{monthly_kwh:.1f} kWh**")

with tcol2:
    if system_type == "Grid-Tied":
        st.write("**Battery Recommendation:**")
        if surplus_solar_kwh > 0:
            num_batt_suggested = math.ceil(surplus_solar_kwh / battery_unit_kwh) if battery_unit_kwh > 0 else 1
            st.info(f"Adding **{num_batt_suggested}x {selected_battery_label}** battery units would allow you to capture the surplus solar and shift to Scenario 3 savings.")
            st.metric(f"Suggested {selected_battery_label} Units", f"{num_batt_suggested}")
        else:
            st.success("Your daytime load consumes all solar production. Battery storage is optional for backup only.")
    else:
        st.write(f"**{system_type} Storage Setup:**")
        st.write(f"- Target Backup: **{backup_hours} hours**")
        st.write(f"- Energy Storage Capacity: **{battery_capacity_total:.1f} kWh**")
        st.metric(f"Total {selected_battery_label} Units", f"{num_batt_scenario}")

# Footer
st.markdown(f"""
    <div class="footer">
        <h3>Contact Us</h3>
        <p>For professional installation and detailed assessments:</p>
        
        <a href="https://www.facebook.com/messages/t/kinmopwcorporation?text=Hello!%20I%20used%20your%20Solar%20Feasibility%20Tool%20and%20would%20like%20to%20request%20a%20quote." class="btn-primary" target="_blank">
            💬 Request a Quote from Kinmo
        </a>

        <p><strong>Kinmo PW Corporation</strong></p>
        <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px;">
            <div><strong>🏢 Office:</strong> 0977 840 7799 | 0916 705 0208</div>
            <div><strong>⚡ Sales:</strong> 0968 726 9310 (Earl Dy)</div>
        </div>
        <p><a href="mailto:earldy.kpwunibest@gmail.com">earldy.kpwunibest@gmail.com</a></p>
    </div>
    """, unsafe_allow_html=True)
