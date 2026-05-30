-- ====================================================================
-- INSTA-SCM DESIGN DASHBOARD & PROJECT BOARD SEED SCRIPT (PostgreSQL)
-- Seeds: user, client, dashboardproject, projectlink, projectresource, projectauditlog
-- ====================================================================

-- 1. CLEAN UP EXISTING DESIGN-RELATED TABLES
DELETE FROM "projectresource";
DELETE FROM "projectlink";
DELETE FROM "projectauditlog";
DELETE FROM "dashboardproject";
DELETE FROM "client";
DELETE FROM "user";

-- 2. SEED USERS (Matches original auth credentials & passwords)
INSERT INTO "user" (
    "id", "full_name", "email", "hashed_password", "role", "is_active", 
    "mfa_enabled", "failed_login_attempts", "created_at", "updated_at"
) VALUES 
(1, 'Parthiv patel', 'parthivpatel684@gmail.com', '$2b$12$o7rPzRTNWzwp/0nfwRB0peQYgzLEN1/q6z5LWt193h/Yibq2S565q', 'Admin', TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Test User', 'test@test.com', '$2b$12$bsjeqvKNS1qUbIFySwfZOuq6wpXPjYP0qXGMxGOzsKWYnLvyy.3sa', 'Operator', TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Parthiv patel 2', 'parthivpatel6842@gmail.com', '$2b$12$oURG0oiE8KlCQgkp8XVgeObSacql5MAmywfx7rOgigXcZAucwmvWW', 'Operator', TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Parthiv patel 1', 'parthivpatel6841@gmail.com', '$2b$12$JQgLuGj471X56wHeT0LvoOtht15JKRd1YkMCe48dRkN/nBCnVOKDW', 'Operator', TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'Parthiv SCM', 'parthiv@insta-scm.com', 'DUMMY_PASSWORD_SCM', 'PROJECT_MANAGER', TRUE, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. SEED CLIENTS
INSERT INTO "client" ("id", "name", "industry", "created_at", "updated_at") VALUES
(1, 'Reliance Industries', 'Conglomerate', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'Wipro', 'Technology', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'Havells', 'Electrical', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'Agilent Technologies', 'Life Sciences', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'Mahindra Electric', 'Automotive', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 'Asian Paints', 'Chemicals', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 'Godrej Appliances', 'Consumer Durables', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 'UltraTech Cement', 'Construction', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 'Pidilite', 'Industrial Materials', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(10, 'Tata Consumer', 'FMCG', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. SEED PROJECTS (dashboardproject)
INSERT INTO "dashboardproject" (
    "id", "crm_project_id", "project_name", "client_id", "city", "event_name", "team_type",
    "stage", "board_stage", "status", "priority", "revision_count", "current_version", "is_active",
    "booking_date", "revision_history", "venue", "area", "branch", "manager_id",
    "event_start_date", "event_end_date", "dispatch_date", "installation_start_date", "installation_end_date",
    "dismantling_date", "allocation_start_date", "allocation_end_date", "comments", "materials", "photos", "qc_steps",
    "created_at", "updated_at"
) VALUES
-- Project 1: Wipro (Won, Active, High Priority)
(1, 'CRM-DES-2401', 'Wipro Innovation Pavilion Bengaluru', 2, 'Bengaluru', 'Smart Manufacturing Expo', 'In-house',
 'Confirmed', 'Production', 'won', 'high', 2, 'V3', TRUE,
 '2026-04-01', '[{"version":"V1","notes":"Initial concept shared","timestamp":"2026-04-03T09:00:00Z"},{"version":"V2","notes":"Updated pavilion branding submitted","timestamp":"2026-04-05T11:30:00Z"},{"version":"V3","notes":"Final pavilion approved by client","timestamp":"2026-04-08T15:00:00Z"}]',
 'Bangalore International Exhibition Centre', '120 Sqm', 'Bangalore', 5,
 '2026-06-10', '2026-06-14', '2026-06-07', '2026-06-08', '2026-06-09',
 '2026-06-15', '2026-06-05', '2026-06-14', 
 '[{"user":"Parthiv SCM","text":"Materials ordered and structural engineer sign-off completed.","timestamp":"2026-05-25T10:00:00Z"}]',
 '["Aluminum extrusion Truss", "Plywood flooring panel", "Tension Fabric graphics", "LED Spotlights", "65 Inch Smart TV"]',
 '[]', '[{"step":"Structural Integrity Check","checked":true},{"step":"Graphic Alignment Proof","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 2: Agilent (Changes requested, Active, Medium Priority)
(2, 'CRM-DES-2402', 'Agilent Experience Center Pune', 4, 'Pune', 'Pharma Pack Expo', 'Contractor',
 'Open', 'Proposal', 'changes', 'medium', 1, 'V2', TRUE,
 '2026-03-07', '[{"version":"V1","notes":"Initial booth concept shared","timestamp":"2026-03-10T10:00:00Z"},{"version":"V2","notes":"Client requested revisions to welcome wall and counters","timestamp":"2026-03-15T14:20:00Z"}]',
 'Auto Cluster Exhibition Center', '72 Sqm', 'Pune', 5,
 '2026-06-18', '2026-06-21', '2026-06-15', '2026-06-16', '2026-06-17',
 '2026-06-22', '2026-06-13', '2026-06-21',
 '[{"user":"Test User","text":"Awaiting final feedback on welcome desk color options.","timestamp":"2026-05-27T16:00:00Z"}]',
 '["MDF Painted structures", "Laminated counters", "Acrylic 3D lit logo", "Under-shelf LED strips"]',
 '[]', '[{"step":"3D render aesthetic signoff","checked":true},{"step":"AutoCAD detailed drafting","checked":false}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 3: Reliance Opportunity (Lost, Inactive)
(3, 'CRM-DES-2403', 'Reliance Brand Experience Mumbai', 1, 'Mumbai', 'Mobility Next Forum', 'In-house',
 'Lost', 'TBC', 'lost', 'low', 0, 'V1', FALSE,
 '2026-03-12', '[{"version":"V1","notes":"Initial design pack sent","timestamp":"2026-03-15T09:00:00Z"}]',
 'Jio World Convention Centre', '90 Sqm', 'Mumbai', NULL,
 '2026-05-20', '2026-05-22', '2026-05-17', '2026-05-18', '2026-05-19',
 '2026-05-23', '2026-05-15', '2026-05-22',
 '[{"user":"Parthiv patel","text":"Lost due to budget limitations on custom wooden fabrication.","timestamp":"2026-04-12T11:00:00Z"}]',
 '[]', '[]', '[]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 4: Havells (Won, Graphic Prep, High Priority)
(4, 'CRM-DES-5001', 'Havells Signature Stand Dubai', 3, 'Dubai', 'BuildTech India', 'Contractor',
 'Confirmed', 'Graphic Prep', 'won', 'high', 1, 'V2', TRUE,
 '2026-04-12', '[{"version":"V1","notes":"Initial concept sent","timestamp":"2026-04-15T12:00:00Z"},{"version":"V2","notes":"Revised lighting layout and material scheme","timestamp":"2026-04-20T10:00:00Z"}]',
 'Dubai World Trade Centre', '108 Sqm', 'Dubai', 5,
 '2026-06-25', '2026-06-28', '2026-06-21', '2026-06-23', '2026-06-24',
 '2026-06-29', '2026-06-20', '2026-06-28',
 '[{"user":"Parthiv SCM","text":"Print files sent to Dubai production partner for graphic print.","timestamp":"2026-05-28T09:30:00Z"}]',
 '["Custom wooden framing", "High-gloss flooring", "RGB Smart LED controller", "OLED Screen array"]',
 '[]', '[{"step":"Graphic resolution check","checked":true},{"step":"Electrical layout validation","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 5: Mahindra (In Progress, Designing, Medium Priority)
(5, 'CRM-DES-5002', 'Mahindra Launch Stand Delhi', 5, 'Delhi', 'Mobility Next Forum', 'In-house',
 'Open', 'Proposal', 'in_progress', 'medium', 0, 'V1', TRUE,
 '2026-04-15', '[{"version":"V1","notes":"Initial draft in development","timestamp":"2026-04-18T09:00:00Z"}]',
 'Pragati Maidan', '144 Sqm', 'Delhi', 5,
 '2026-07-02', '2026-07-05', '2026-06-28', '2026-06-29', '2026-06-30',
 '2026-07-06', '2026-06-26', '2026-07-05',
 '[{"user":"Parthiv SCM","text":"Developing custom EV charger replica mockups for the center stand.","timestamp":"2026-05-24T14:00:00Z"}]',
 '["Metallic structural framing", "Turf flooring", "Interactive touch kiosks", "EV charger mockups"]',
 '[]', '[{"step":"Aesthetic consistency review","checked":false}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 6: Godrej (Won, Pre-Build, Low Priority)
(6, 'CRM-DES-5003', 'Godrej Experience Lounge Chennai', 7, 'Chennai', 'RetailX Summit', 'Contractor',
 'Confirmed', 'Pre-Build', 'won', 'low', 1, 'V2', TRUE,
 '2026-04-18', '[{"version":"V1","notes":"Layout deck shared","timestamp":"2026-04-20T10:00:00Z"},{"version":"V2","notes":"Branding elements and appliance placement aligned","timestamp":"2026-04-25T11:00:00Z"}]',
 'Chennai Trade Centre', '54 Sqm', 'Chennai', 5,
 '2026-07-10', '2026-07-12', '2026-07-07', '2026-07-08', '2026-07-09',
 '2026-07-13', '2026-07-05', '2026-07-12',
 '[{"user":"Test User","text":"Appliance delivery to venue confirmed by client logistics team.","timestamp":"2026-05-27T10:00:00Z"}]',
 '["Modular Octanorm system", "Carpet tiles", "Foil printed fascia", "Standard power socket loops"]',
 '[]', '[{"step":"Appliance dimension tolerance verification","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 7: Asian Paints (In Progress, Drafting, High Priority)
(7, 'CRM-DES-5004', 'Asian Paints Signature Stand Hyderabad', 6, 'Hyderabad', 'Design & Build Week', 'In-house',
 'Open', 'Proposal', 'in_progress', 'high', 2, 'V3', TRUE,
 '2026-04-20', '[{"version":"V1","notes":"Conceptual renders shared","timestamp":"2026-04-22T09:00:00Z"},{"version":"V2","notes":"Color swatches panel updated per brand guidelines","timestamp":"2026-04-26T14:00:00Z"},{"version":"V3","notes":"Updated structural height limits in drawings","timestamp":"2026-05-10T16:00:00Z"}]',
 'HITEX Exhibition Centre', '90 Sqm', 'Hyderabad', 5,
 '2026-07-15', '2026-07-18', '2026-07-11', '2026-07-13', '2026-07-14',
 '2026-07-19', '2026-07-09', '2026-07-18',
 '[{"user":"Parthiv SCM","text":"Final feedback round on the illuminated wall sections is underway.","timestamp":"2026-05-28T11:00:00Z"}]',
 '["Wooden double-decker framework", "Custom color display racks", "RGB color-washing lights", "Plexiglas diffusers"]',
 '[]', '[{"step":"Double-deck static weight calculations","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 8: Pidilite (Won, Handover completed, Medium Priority)
(8, 'CRM-DES-5005', 'Pidilite Brand Experience Kolkata', 9, 'Kolkata', 'Smart Living Show', 'Contractor',
 'Confirmed', 'Handover', 'won', 'medium', 1, 'V2', TRUE,
 '2026-04-22', '[{"version":"V1","notes":"Concept shared","timestamp":"2026-04-24T10:00:00Z"},{"version":"V2","notes":"Final structural design package approved","timestamp":"2026-04-30T11:00:00Z"}]',
 'Biswa Bangla Mela Prangan', '90 Sqm', 'Kolkata', 5,
 '2026-07-22', '2026-07-25', '2026-07-18', '2026-07-20', '2026-07-21',
 '2026-07-26', '2026-07-17', '2026-07-25',
 '[{"user":"Parthiv SCM","text":"Handover successful. Stand built, inspected, and signed off.","timestamp":"2026-05-26T17:00:00Z"}]',
 '["FunderMax exterior cladding", "Heavy-duty steel floor base", "Interactive glue demonstration table"]',
 '[]', '[{"step":"Inspected by safety inspector","checked":true},{"step":"Cleanliness and paint touchup finished","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 9: UltraTech Cement (Won, Production, High Priority)
(9, 'CRM-DES-5006', 'UltraTech Concrete Pavilion Pune', 8, 'Pune', 'BuildTech India', 'Contractor',
 'Confirmed', 'Production', 'won', 'high', 2, 'V3', TRUE,
 '2026-04-24', '[{"version":"V1","notes":"Structural drawings shared","timestamp":"2026-04-26T10:00:00Z"},{"version":"V2","notes":"Revised mix designs and sample blocks approved","timestamp":"2026-05-02T12:00:00Z"},{"version":"V3","notes":"Final structural sign-off on columns","timestamp":"2026-05-18T16:00:00Z"}]',
 'Auto Cluster Exhibition Center', '100 Sqm', 'Pune', 5,
 '2026-07-28', '2026-07-31', '2026-07-24', '2026-07-25', '2026-07-27',
 '2026-08-01', '2026-07-22', '2026-07-31',
 '[{"user":"Parthiv SCM","text":"Columns and flooring slabs arrived at pre-fabrication warehouse.","timestamp":"2026-05-28T14:00:00Z"}]',
 '["Pre-cast concrete pillars", "Reinforced steel framing", "Branded lightboxes", "Textured wall finishes"]',
 '[]', '[{"step":"Structural load proof check","checked":true},{"step":"Signage placement alignment","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 10: Mahindra Electric (Won, Graphic Prep, Medium Priority)
(10, 'CRM-DES-5007', 'Mahindra EV Fleet Center Mumbai', 5, 'Mumbai', 'Mobility Next Forum', 'In-house',
 'Confirmed', 'Graphic Prep', 'won', 'medium', 1, 'V2', TRUE,
 '2026-04-26', '[{"version":"V1","notes":"Conceptual renders and car placement shared","timestamp":"2026-04-28T11:00:00Z"},{"version":"V2","notes":"Backdrop graphics aligned to 2026 branding specs","timestamp":"2026-05-15T15:00:00Z"}]',
 'Jio World Convention Centre', '120 Sqm', 'Mumbai', 5,
 '2026-08-02', '2026-08-05', '2026-07-29', '2026-07-31', '2026-08-01',
 '2026-08-06', '2026-07-27', '2026-08-05',
 '[{"user":"Test User","text":"Car display platform load calculations verified. Graphics in print.","timestamp":"2026-05-28T15:00:00Z"}]',
 '["Gloss black floor tiles", "Custom high-load ramp", "Curved LED screen backdrop", "Vinyl graphics rolls"]',
 '[]', '[{"step":"Graphic dimensions proof checked","checked":true},{"step":"Screen feed video loop test","checked":false}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 11: Asian Paints (Won, Pre-Build, Low Priority)
(11, 'CRM-DES-5008', 'Asian Paints Gallery Lounge Bengaluru', 6, 'Bengaluru', 'Design & Build Week', 'Contractor',
 'Confirmed', 'Pre-Build', 'won', 'low', 1, 'V2', TRUE,
 '2026-04-28', '[{"version":"V1","notes":"Aesthetic scheme and swatch layout shared","timestamp":"2026-04-30T09:00:00Z"},{"version":"V2","notes":"Updated sample wall sections and paint grades","timestamp":"2026-05-12T14:00:00Z"}]',
 'Bangalore International Exhibition Centre', '80 Sqm', 'Bangalore', 5,
 '2026-08-08', '2026-08-11', '2026-08-04', '2026-08-06', '2026-08-07',
 '2026-08-12', '2026-08-02', '2026-08-11',
 '[{"user":"Parthiv SCM","text":"Paint tins and custom wooden partition walls dispatched to BIEC local storage.","timestamp":"2026-05-28T15:20:00Z"}]',
 '["Eco-friendly premium paint array", "Plywood partition panels", "Warm spotlights", "Plush seating lounges"]',
 '[]', '[{"step":"Paint swatch verification under warm light","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Project 12: Tata Consumer (Won, Handover, High Priority)
(12, 'CRM-DES-5009', 'Tata Tea Experience Hub Delhi', 10, 'Delhi', 'FoodTech India', 'In-house',
 'Confirmed', 'Handover', 'won', 'high', 1, 'V2', TRUE,
 '2026-05-02', '[{"version":"V1","notes":"Tea tasting bar concept shared","timestamp":"2026-05-04T10:00:00Z"},{"version":"V2","notes":"Approved structural plans and graphic layouts","timestamp":"2026-05-10T11:00:00Z"}]',
 'Pragati Maidan', '64 Sqm', 'Delhi', 5,
 '2026-08-15', '2026-08-18', '2026-08-11', '2026-08-13', '2026-08-14',
 '2026-08-19', '2026-08-09', '2026-08-18',
 '[{"user":"Parthiv SCM","text":"Tasting bar build fully completed. Client sign-off sheet signed. Handover done!","timestamp":"2026-05-28T15:30:00Z"}]',
 '["Solid oak bar counter", "Under-counter sink & plumbing", "High-res brand graphic panels", "Ambient overhead hanging lamps"]',
 '[]', '[{"step":"Plumbing pressure check","checked":true},{"step":"Fascia sign lights check","checked":true},{"step":"Final dust and clean","checked":true}]',
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 5. SEED PROJECT LINKS (projectlink)
INSERT INTO "projectlink" ("id", "project_id", "link_type", "label", "url", "created_by", "created_at", "updated_at") VALUES
(1, 1, 'drive', 'Wipro Design Folder', 'https://drive.google.com/drive/folders/1wipro-smart-mfg-expo', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, 'autocad', 'Wipro AutoCAD Layout V3', 'https://autodesk360.com/viewer/wipro-mfg-v3-layout', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 1, 'render', 'Wipro 3D Render Perspective', 'https://insta-scm.com/renders/wipro-mfg-front.jpg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 2, 'drive', 'Agilent Shared Assets', 'https://drive.google.com/drive/folders/1agilent-pune-pharma', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 2, 'render', 'Agilent Render Concept', 'https://insta-scm.com/renders/agilent-booth-persp.jpg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 4, 'drive', 'Havells Dubai Shared Folder', 'https://drive.google.com/drive/folders/1havells-dubai-buildtech', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 4, 'render', 'Havells Dubai 3D Renders', 'https://insta-scm.com/renders/havells-dubai-render.jpg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 7, 'autocad', 'Asian Paints Double-Decker CAD', 'https://autodesk360.com/viewer/ap-doubledeck-v3', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 9, 'autocad', 'UltraTech Pune Civil Layout', 'https://autodesk360.com/viewer/ultratech-pune-layout', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(10, 10, 'render', 'Mahindra EV Stage 3D View', 'https://insta-scm.com/renders/mahindra-ev-stage.jpg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 12, 'drive', 'Tata Tea Tasting Bar Details', 'https://drive.google.com/drive/folders/1tata-tea-bar-foodtech', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 6. SEED PROJECT RESOURCES (projectresource)
INSERT INTO "projectresource" (
    "id", "project_id", "resource_type", "entry_key", "label", "version_number", 
    "source_type", "url", "file_name", "file_content", "mime_type", "created_by", "created_at", "updated_at"
) VALUES
(1, 1, 'design', 'wipro_3d_pack', 'Wipro 3D Perspective Pack V1', 1, 'link', 'https://insta-scm.com/renders/wipro-v1.zip', 'wipro-v1-render.zip', NULL, 'application/zip', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, 'design', 'wipro_3d_pack', 'Wipro 3D Perspective Pack V2', 2, 'link', 'https://insta-scm.com/renders/wipro-v2.zip', 'wipro-v2-render.zip', NULL, 'application/zip', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 1, 'design', 'wipro_3d_pack', 'Wipro 3D Perspective Pack V3 (Final)', 3, 'link', 'https://insta-scm.com/renders/wipro-v3-final.zip', 'wipro-v3-final.zip', NULL, 'application/zip', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 1, 'autocad', 'wipro_drawings', 'Wipro Civil and Floor layout DWG V1', 1, 'link', 'https://insta-scm.com/drawings/wipro-v1.dwg', 'wipro-v1.dwg', NULL, 'image/vnd.dwg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 1, 'autocad', 'wipro_drawings', 'Wipro Civil and Floor layout DWG V2', 2, 'link', 'https://insta-scm.com/drawings/wipro-v2.dwg', 'wipro-v2.dwg', NULL, 'image/vnd.dwg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 2, 'autocad', 'agilent_dwg', 'Agilent Exhibition Booth Detailed Plan V1', 1, 'link', 'https://insta-scm.com/drawings/agilent-v1.dwg', 'agilent-v1.dwg', NULL, 'image/vnd.dwg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 2, 'autocad', 'agilent_dwg', 'Agilent Exhibition Booth Detailed Plan V2', 2, 'link', 'https://insta-scm.com/drawings/agilent-v2.dwg', 'agilent-v2.dwg', NULL, 'image/vnd.dwg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 4, 'graphic_file', 'havells_graphics', 'Havells Brand Graphics High-Res PDF V1', 1, 'link', 'https://insta-scm.com/prints/havells-gr-v1.pdf', 'havells-print-v1.pdf', NULL, 'application/pdf', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 4, 'graphic_file', 'havells_graphics', 'Havells Brand Graphics High-Res PDF V2', 2, 'link', 'https://insta-scm.com/prints/havells-gr-v2-final.pdf', 'havells-print-v2-final.pdf', NULL, 'application/pdf', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(10, 9, 'design', 'ultratech_concrete', 'UltraTech Concrete Pavilion Specs V1', 1, 'link', 'https://insta-scm.com/renders/ultratech-v1.zip', 'ultratech-v1-render.zip', NULL, 'application/zip', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 9, 'autocad', 'ultratech_cad', 'UltraTech Pune Structure DWG V1', 1, 'link', 'https://insta-scm.com/drawings/ultratech-pune-v1.dwg', 'ultratech-pune-v1.dwg', NULL, 'image/vnd.dwg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(12, 10, 'graphic_file', 'mahindra_graphics', 'Mahindra Curved Backdrop Vinyl Proof V1', 1, 'link', 'https://insta-scm.com/prints/mahindra-ev-v1.pdf', 'mahindra-v1.pdf', NULL, 'application/pdf', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(13, 12, 'autocad', 'tata_tea_plumbing', 'Tata Tasting Bar Plumbing Layout V1', 1, 'link', 'https://insta-scm.com/drawings/tata-bar-plumbing.dwg', 'tata-bar-plumbing.dwg', NULL, 'image/vnd.dwg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 7. SEED PROJECT AUDIT LOGS (projectauditlog)
INSERT INTO "projectauditlog" ("id", "project_id", "change_type", "prev_state", "new_state", "changed_by_id", "timestamp") VALUES
(1, 1, 'STAGE_CHANGE', '{"stage": "Open", "board_stage": "TBC"}', '{"stage": "Confirmed", "board_stage": "Proposal"}', 1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(2, 1, 'STAGE_CHANGE', '{"board_stage": "Proposal"}', '{"board_stage": "Production"}', 5, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 2, 'REVISION_UPDATE', '{"current_version": "V1", "revision_count": 0}', '{"current_version": "V2", "revision_count": 1}', 1, CURRENT_TIMESTAMP - INTERVAL '4 days'),
(4, 4, 'STAGE_CHANGE', '{"board_stage": "Proposal"}', '{"board_stage": "Graphic Prep"}', 5, CURRENT_TIMESTAMP - INTERVAL '1 days'),
(5, 7, 'REVISION_UPDATE', '{"current_version": "V2", "revision_count": 1}', '{"current_version": "V3", "revision_count": 2}', 1, CURRENT_TIMESTAMP - INTERVAL '8 hours'),
(6, 9, 'STAGE_CHANGE', '{"board_stage": "Proposal"}', '{"board_stage": "Production"}', 5, CURRENT_TIMESTAMP - INTERVAL '3 days'),
(7, 10, 'STAGE_CHANGE', '{"board_stage": "Proposal"}', '{"board_stage": "Graphic Prep"}', 5, CURRENT_TIMESTAMP - INTERVAL '1 days'),
(8, 12, 'STAGE_CHANGE', '{"board_stage": "Production"}', '{"board_stage": "Handover"}', 5, CURRENT_TIMESTAMP - INTERVAL '4 hours');
