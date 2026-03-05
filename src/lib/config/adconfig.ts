// src/lib/config/adConfig.ts

export const EntityBSJ = "OU=ENTITY - BSJ";
export const DomainDN = "DC=BOS,DC=local";
export const AllStaffGroup =
  "CN=All BSJ Staff,OU=GROUPS,OU=ENTITY - BSJ,DC=BOS,DC=local";

export const AD_CONFIG = {
  domains: {
    "bsj.org.jm": {
      server: "BOS.local",
      defaultUPN: "bsj.org.jm",
      departments: {
        ICT: {
          ou: `OU=MIS_Staff,OU=MIS,${DomainDN}`,
          groups: [
            AllStaffGroup,
            `CN=ICT Branch,OU=MIS_Staff,OU=MIS,${DomainDN}`
          ]
        },

        Finance: {
          ou: `OU=FINANCE BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        HR: {
          ou: `OU=HUMAN RESOURCES BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        QEMS: {
          ou: `OU=QEMS BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        OFMB: {
          ou: `OU=OFFICE FACILITIES MANAGEMENT BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        OFMB_FACILITIES_ADMINISTRATION: {
          ou: `OU=FACILITIES ADMINISTRATION,OU=OFFICE FACILITIES MANAGEMENT BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        OFMB_PROPERTY_AND_PROJECTS: {
          ou: `OU=PROPERTY & PROJECTS,OU=OFFICE FACILITIES MANAGEMENT BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        CCSB: {
          ou: `OU=MARKETING AND PUBLIC RELATIONS,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        CUSTOMER_SERVICE: {
          ou: `OU=CUSTOMERSERVICE,OU=MARKETING AND PUBLIC RELATIONS,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        STANDARDS: {
          ou: `OU=STANDARDS BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        TRAINING: {
          ou: `OU=TRAINING BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        LEGAL_OFFICE: {
          ou: `OU=LEGAL OFFICE BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        INTERNAL_AUDIT: {
          ou: `OU=INTERNAL AUDIT BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        EXECUTIVE_OFFICE: {
          ou: `OU=EXECTIVE OFFICE,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        EXECUTIVE_DIRECTOR: {
          ou: `OU=EXECUTIVE DIRECTOR,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        BDO: {
          ou: `OU=BDO,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        CORPORATE_OFFICE: {
          ou: `OU=CORPOFFICE,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        SPECIAL_PROJECTS: {
          ou: `OU=SPECIAL PROJECTS BRANCH,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        CHEMISTRY: {
          ou: `OU=CHEMISTRY BRANCH,OU=ANALYTICAL SERVICES,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        MICROBIOLOGY: {
          ou: `OU=MICROBIOLOGY BRANCH,OU=ANALYTICAL SERVICES,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        PACKAGING: {
          ou: `OU=PACKAGING BRANCH,OU=ANALYTICAL SERVICES,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        MECHANICAL: {
          ou: `OU=MECHANICAL BRANCH,OU=ENGINEERING,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        ELECTRICAL: {
          ou: `OU=ELECTRICAL BRANCH,OU=ENGINEERING,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        METALLURGY: {
          ou: `OU=METALLURGY BRANCH,OU=ENGINEERING,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        },

        CIVIL: {
          ou: `OU=CIVIL BRANCH,OU=ENGINEERING,${EntityBSJ},${DomainDN}`,
          groups: [AllStaffGroup]
        }
      }
    },

    "ncra.org.jm": {
      server: "BOS.local",
      defaultUPN: "ncra.org.jm",
      departments: {
        MAIN_OFFICE: {
          ou: "OU=USERS - MAIN OFFICE,OU=ENTITY - NCRA,DC=BOS,DC=local",
          groups: [
            "CN=All NCRA Staff,OU=GROUPS,OU=ENTITY - NCRA,DC=BOS,DC=local"
          ]
        },

        REGIONAL_OFFICE: {
          ou: "OU=USERS - REGIONAL OFFICE,OU=ENTITY - NCRA,DC=BOS,DC=local",
          groups: [
            "CN=All NCRA Staff,OU=GROUPS,OU=ENTITY - NCRA,DC=BOS,DC=local"
          ]
        }
      }
    },

    "ncbj.org.jm": {
      server: "BOS.local",
      defaultUPN: "ncbj.org.jm",
      departments: {
        NCBJ_Staff: {
          ou: "OU=USERS,OU=ENTITY - NCBJ,DC=BOS,DC=local",
          groups: [
            "CN=ALL NCBJ Staff,OU=GROUPS,OU=ENTITY - NCBJ,DC=BOS,DC=local"
          ]
        }
      }
    },

    "hsra.org.jm": {
      server: "BOS.local",
      defaultUPN: "hsra.org.jm",
      departments: {
        HSRA_Staff: {
          ou: "OU=USERS,OU=ENTITY - HSRA,DC=BOS,DC=local",
          groups: [
            "CN=HSRA,OU=GROUPS,OU=ENTITY - HSRA,DC=BOS,DC=local"
          ]
        }
      }
    }
  }
};


export function getOUForDepartment(domain: keyof typeof AD_CONFIG.domains, department: string): string {
    const departmentObj = AD_CONFIG.domains[domain].departments as any;
    if (!departmentObj) {
        throw new Error(`Domain ${domain} not found in AD configuration`);
    }
    let d = departmentObj[department];
    if (!d) {
        throw new Error(`Department ${department} not found in domain ${domain}`);
    }
    return d.ou as string;
}

export function getGroupsForDepartment(domain: keyof typeof AD_CONFIG.domains, department: string): string[] {
    const departmentObj = AD_CONFIG.domains[domain].departments as any;
    if (!departmentObj) {
        throw new Error(`Domain ${domain} not found in AD configuration`);
    }
    let d = departmentObj[department];
    if (!d) {
        throw new Error(`Department ${department} not found in domain ${domain}`);
    }
    return d.groups as string[];
}